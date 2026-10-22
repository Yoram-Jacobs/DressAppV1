import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, Loader2, Languages, Newspaper, Calendar, Users, TrendingUp, Shirt } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { CalendarConnect } from '@/components/CalendarConnect';
import { LocationCard } from '@/components/LocationCard';
import { InviteFriendsButton } from '@/components/InviteFriendsButton';
import { ProfileDetailsCard } from '@/components/ProfileDetailsCard';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import OnboardingMigrationModal from '@/components/OnboardingMigrationModal';
import {
  SchedulerSettings,
  AIConfiguration,
  SubscriptionSettings,
  ShoppingAssistant,
  ImportWardrobeSection,
} from '@/components/profile/index.js';
import PricingBanner from '../assets/img/inner6.webp';
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, updateUserLocal, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    preferred_language: (user?.preferred_language || i18n.language || 'en').toLowerCase(),
    preferred_voice_id: user?.preferred_voice_id || 'aura-2-thalia-en',
  });
  const [langBusy, setLangBusy] = useState(false);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [migrationInitialApp, setMigrationInitialApp] = useState(null);
  const [migrationInitialStep, setMigrationInitialStep] = useState(null);



  const isTester = Boolean(
    user?.subscription?.is_tester ||
    user?.subscription?.plan_type === 'tester' ||
    user?.roles?.includes('tester')
  );

  useEffect(() => {
    api.getMe().then((freshUser) => {
      if (freshUser) {
        updateUserLocal(freshUser);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const items = [];
    if (searchParams.get('open') === 'scheduler' || location.hash === '#scheduler-settings-section' || location.state?.scrollTo === 'scheduler-settings-section') {
      items.push('scheduler');
      setTimeout(() => {
        document.getElementById('scheduler-settings-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
    if (isTester && (searchParams.get('open') === 'ai-config' || searchParams.get('tab') === 'ai-config' || location.hash === '#ai-configuration-section' || location.state?.scrollTo === 'ai-configuration-section')) {
      items.push('ai-config');
      setTimeout(() => {
        document.getElementById('ai-configuration-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
    if (items.length > 0) {
      setExpandedItems(items);
    }
  }, [searchParams, location, isTester]);

  useEffect(() => {
    if (user?.preferred_language) {
      const code = user.preferred_language.toLowerCase();
      setForm((f) => {
        if (f.preferred_language === code) return f;
        return { ...f, preferred_language: code };
      });
    }
  }, [user?.preferred_language]);

  const onLanguageChange = async (code) => {
    const DEFAULT_VOICES = {
      en: 'en_US-ryan-medium',
      es: 'es_ES-carl-medium',
      fr: 'fr_FR-gilles-low',
      de: 'de_DE-thorsten-medium',
      it: 'it_IT-riccardo-medium',
      pt: 'pt_BR-faber-medium',
      ru: 'ru_RU-dmitri-medium',
      zh: 'zh_CN-huayan-medium',
      ja: 'ja_JP-koko-medium',
      ar: 'ar_JO-kareem-low',
      hi: 'hi_IN-rohan-medium',
      he: 'he_IL-hebrew-medium',
    };
    const voiceId = DEFAULT_VOICES[code] || 'en_US-ryan-medium';
    setForm((f) => ({ ...f, preferred_language: code, preferred_voice_id: voiceId }));
    setLangBusy(true);
    try {
      await i18n.changeLanguage(code);
      try { localStorage.setItem('dressapp.lang', code); } catch { /* ignore */ }
      const res = await api.patchMe({ preferred_language: code, preferred_voice_id: voiceId });
      updateUserLocal(res);
      toast.success(t('profile.languageUpdated'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('profile.saveFailed'));
    } finally {
      setLangBusy(false);
    }
  };



  const handleOpenMigrationForApp = (app) => {
    if (app) {
      setMigrationInitialApp(app);
      setMigrationInitialStep('web_login');
    } else {
      setMigrationInitialApp(null);
      setMigrationInitialStep(null);
    }
    setIsMigrationModalOpen(true);
  };

  return (
    <>
      {/* Banner Section */}
      <PageHeroBanner image={PricingBanner}>
        <div className="relative z-10 w-full">
          <div
            className="
                  px-10 py-20
                 max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]
                "
          >
            <div className="max-w-[520px]">
              <h1
                className="
                      m-0 mb-0
                      text-[40px] leading-[40px]
                      font-bold
                      tracking-normal
                      text-white
                      max-[480px]:text-[20px]
                      max-[480px]:leading-[30px]
                      max-[480px]:mb-3
                    "
              >
                {t('profile.title')}
              </h1>
              <p
                className="
                      my-5
                      max-w-[450px]
                      text-[14px]
                      leading-6
                      tracking-[0.5px]
                      text-white/60
                      max-[767px]:max-w-full
                      max-[767px]:mt-[15px]
                    "
              >
                {t('pricing.subtitle', { defaultValue: 'Choose the plan that fits your style. Upgrade, downgrade, or cancel at any time.' })}
              </p>

            </div>
          </div>
        </div>
      </PageHeroBanner>
      <section className="bg-accent-beige px-[40px] py-[40px] max-[991px]:px-[15px] max-[991px]:py-[30px] max-[767px]:px-[15px] max-[767px]:py-[30px] 
        max-[480px]:px-[15px] max-[480px]:py-[30px]">
        <div className="bg-white rounded-[12px] p-4 shadow-sm border border-border mb-5">
          <h3 className="text-[16px] text-dark-brand font-bold mb-4">{t('profile.exploreTitle', { defaultValue: 'Explore DressApp' })}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
            {/* Explore Section (Secondary Nav) */}
            <div className="lg:col-span-4" data-testid="explore-card">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Link to="/trends" className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded-[12px] border border-border bg-white hover:bg-primary-shadow hover:shadow-md hover:border-primary-brand hover:-translate-y-0.5 transition-all duration-200 text-center" data-testid="explore-trend-scout">
                  <span className="flex items-center justify-center h-11 w-11 rounded-xl bg-orange-500/10">
                    <Newspaper className="h-5 w-5 text-orange-500" />
                  </span>
                  <span className="text-xs font-semibold text-text-brand">{t('home.trendScout', { defaultValue: 'Trend Scout' })}</span>
                </Link>
                <Link to="/outfits" className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded-[12px] border border-border bg-white hover:bg-primary-shadow hover:shadow-md hover:border-primary-brand hover:-translate-y-0.5 transition-all duration-200 text-center" data-testid="explore-outfits">
                  <span className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple-500/10">
                    <Calendar className="h-5 w-5 text-purple-500" />
                  </span>
                  <span className="text-xs font-semibold text-text-brand">{t('nav.outfits', { defaultValue: 'Outfits' })}</span>
                </Link>
                <Link to="/experts" className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded-[12px] border border-border bg-white hover:bg-primary-shadow hover:shadow-md hover:border-primary-brand hover:-translate-y-0.5 transition-all duration-200 text-center" data-testid="explore-experts">
                  <span className="flex items-center justify-center h-11 w-11 rounded-xl bg-teal-600/10">
                    <Users className="h-5 w-5 text-teal-600" />
                  </span>
                  <span className="text-xs font-semibold text-text-brand">{t('nav.experts', { defaultValue: 'Experts' })}</span>
                </Link>
                <Link to="/me/stats" className="flex flex-col items-center justify-center gap-2 py-6 px-3 rounded-[12px] border border-border bg-white hover:bg-primary-shadow hover:shadow-md hover:border-primary-brand hover:-translate-y-0.5 transition-all duration-200 text-center" data-testid="explore-stats">
                  <span className="flex items-center justify-center h-11 w-11 rounded-xl bg-accent-green/10">
                    <TrendingUp className="h-5 w-5 text-accent-green" />
                  </span>
                  <span className="text-xs font-semibold text-text-brand">{t('profile.statsTitle', { defaultValue: 'Unpacked' })}</span>
                </Link>
              </div>
            </div>
            {/* Language selector surfaced up-front so users find it instantly */}
            <div className="lg:col-span-1" data-testid="language-card">
              <div className="">
                <div className="flex items-center justify-end gap-3 mb-4">
                  <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-shadow">
                    <Languages className="h-5 w-5 text-primary-brand" aria-hidden="true" />
                  </span>
                  <div className="text-center">
                    <div className="text-[12px] text-text-brand font-semibold">{t('profile.voiceLanguage')}</div>
                    <div className="font-bold text-[14px] text-dark-brand">{t('profile.language')}</div>
                  </div>
                </div>
                <Select
                  value={form.preferred_language}
                  onValueChange={onLanguageChange}
                  disabled={langBusy}
                >
                  <SelectTrigger data-testid="language-selector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <SelectItem
                        key={l.code}
                        value={l.code}
                        data-testid={`language-option-${l.code}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="font-medium">{l.nativeName}</span>
                          <span className="text-xs text-muted-foreground">· {l.englishName}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ProfileDetailsCard />
          </div>
          <div>
            <Card className="rounded-[12px] border border-border bg-white shadow-sm h-full" data-testid="profile-settings-card">
              <CardContent className="p-5 space-y-4">
                <div className="">
                  <div className="text-[12px] text-text-brand font-semibold">
                    {t('profile.sections.settings', { defaultValue: 'Settings & Integrations' })}
                  </div>
                  <h3 className="font-bold text-[14px] text-dark-brand">{t('profile.settingsTitle', { defaultValue: 'System Preferences' })}</h3>
                </div>
                <Accordion
                  type="multiple"
                  value={expandedItems}
                  onValueChange={setExpandedItems}
                  className="w-full space-y-4"
                >
                  {isTester && <AIConfiguration />}
                  <SubscriptionSettings />
                  <SchedulerSettings />
                  <CalendarConnect />
                  <LocationCard />
                  <InviteFriendsButton />
                  <ShoppingAssistant />
                  <ImportWardrobeSection onSelectAppForMigration={handleOpenMigrationForApp} />
                </Accordion>
                <div className="flex">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-white bg-destructive hover:bg-destructive/50 transition-all duration-300"
                    onClick={() => { logout(); nav('/login'); }}
                    data-testid="settings-logout-button"
                  >
                    <LogOut className="h-4 w-4" /> {t('profile.signOut')}
                  </Button>
                </div>
                <div className="flex justify-center items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => handleOpenMigrationForApp(null)}
                    className=""
                    data-testid="profile-import-wardrobe-pill"
                  >
                    <Shirt className="w-3.5 h-3.5" />
                    <span>{t('profile.importWardrobePill', { defaultValue: 'Import Wardrobe' })}</span>
                  </Button>

                  <Link
                    to="/delete-account"
                    className="text-[12px] font-semibold text-destructive hover:text-dark-brand transition-colors duration-200"
                    data-testid="delete-account-link"
                  >
                    {t('profile.deleteAccountLink', { defaultValue: 'Delete my Account' })}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <OnboardingMigrationModal
          isOpen={isMigrationModalOpen}
          onClose={() => {
            setIsMigrationModalOpen(false);
            setMigrationInitialApp(null);
            setMigrationInitialStep(null);
          }}
          initialApp={migrationInitialApp}
          initialStep={migrationInitialStep}
        />
      </section>
    </>
  );
}
