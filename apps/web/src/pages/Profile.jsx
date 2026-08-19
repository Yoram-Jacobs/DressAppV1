import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LogOut, Loader2, Languages, Bell, Newspaper, Calendar, Users, TrendingUp, Key, Coins, Info, ExternalLink, Save, Chrome, Bookmark, Sparkles, Crown, Shirt } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { CalendarConnect } from '@/components/CalendarConnect';
import { LocationCard } from '@/components/LocationCard';
import { InviteFriendsButton } from '@/components/InviteFriendsButton';
import { ProfileDetailsCard } from '@/components/ProfileDetailsCard';
import { DeveloperPanel } from '@/components/DeveloperPanel';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { labelForDressCode } from '@/lib/taxonomy';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useClosetStore } from '@/lib/useClosetStore';
import OnboardingMigrationModal from '@/components/OnboardingMigrationModal';
import { SchedulerSettings, AIConfiguration, SubscriptionSettings, ShoppingAssistant } from '@/components/profile/index.js';


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
  const [busy, setBusy] = useState(false);
  const [langBusy, setLangBusy] = useState(false);
  const [expandedItems, setExpandedItems] = useState([]);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  const isDirty = useMemo(() => {
    if (!user) return false;
    const initial = {
      preferred_language: (user.preferred_language || i18n.language || 'en').toLowerCase(),
      preferred_voice_id: user.preferred_voice_id || 'aura-2-thalia-en',
    };

    return Object.keys(initial).some(
      (key) => String(form[key]) !== String(initial[key])
    );
  }, [user, form, i18n.language]);

  useEffect(() => {
    const items = [];
    if (searchParams.get('open') === 'scheduler' || location.hash === '#scheduler-settings-section' || location.state?.scrollTo === 'scheduler-settings-section') {
      items.push('scheduler');
      setTimeout(() => {
        document.getElementById('scheduler-settings-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
    if (searchParams.get('open') === 'ai-config' || searchParams.get('tab') === 'ai-config' || location.hash === '#ai-configuration-section' || location.state?.scrollTo === 'ai-configuration-section') {
      items.push('ai-config');
      setTimeout(() => {
        document.getElementById('ai-configuration-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
    if (items.length > 0) {
      setExpandedItems(items);
    }
  }, [searchParams, location]);

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

  const save = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = {
        preferred_language: form.preferred_language,
        preferred_voice_id: form.preferred_voice_id,
      };
      const res = await api.patchMe(body);
      updateUserLocal(res);
      toast.success(t('profile.profileSaved'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('profile.saveFailed'));
    } finally { setBusy(false); }
  };

  return (
    <div className="container-px max-w-3xl mx-auto pt-6 md:pt-10">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="caps-label text-muted-foreground">{t('profile.accountLabel')}</div>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{t('profile.title')}</h1>
        </div>
      </div>

      {/* Explore Section (Secondary Nav) */}
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial mb-6 overflow-hidden" data-testid="explore-card">
        <CardContent className="p-6">
          <h3 className="font-display text-xl mb-4">{t('profile.exploreTitle', { defaultValue: 'Explore DressApp' })}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link to="/trends" className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-center" data-testid="explore-trend-scout">
              <Newspaper className="h-6 w-6 text-orange-500 mb-2" />
              <span className="text-xs font-semibold text-foreground/80">{t('home.trendScout', { defaultValue: 'Trend Scout' })}</span>
            </Link>
            <Link to="/outfits" className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-center" data-testid="explore-outfits">
              <Calendar className="h-6 w-6 text-purple-500 mb-2" />
              <span className="text-xs font-semibold text-foreground/80">{t('nav.outfits', { defaultValue: 'Outfits' })}</span>
            </Link>
            <Link to="/experts" className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-center" data-testid="explore-experts">
              <Users className="h-6 w-6 text-teal-600 mb-2" />
              <span className="text-xs font-semibold text-foreground/80">{t('nav.experts', { defaultValue: 'Experts' })}</span>
            </Link>
            <Link to="/me/stats" className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors text-center" data-testid="explore-stats">
              <TrendingUp className="h-6 w-6 text-accent-green mb-2" />
              <span className="text-xs font-semibold text-foreground/80">{t('profile.statsTitle', { defaultValue: 'Unpacked' })}</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Language selector surfaced up-front so users find it instantly */}
      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial mb-6" data-testid="language-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:gap-6">
            <div className="flex items-center gap-3">
              <Languages className="h-5 w-5 text-[hsl(var(--accent))]" aria-hidden="true" />
              <div>
                <div className="caps-label text-muted-foreground">{t('profile.voiceLanguage')}</div>
                <div className="font-medium">{t('profile.language')}</div>
              </div>
            </div>
            <div className="mt-3 md:mt-0 md:ms-auto w-full md:w-72">
              <Select
                value={form.preferred_language}
                onValueChange={onLanguageChange}
                disabled={langBusy}
              >
                <SelectTrigger className="rounded-xl" data-testid="language-selector">
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
        </CardContent>
      </Card>

      <div className="mb-6">
        <ProfileDetailsCard />
      </div>

      <div className="mb-6">
        <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial" data-testid="profile-settings-card">
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="caps-label text-muted-foreground">
                {t('profile.sections.settings', { defaultValue: 'Settings & Integrations' })}
              </div>
              <h3 className="font-display text-xl mt-0.5">{t('profile.settingsTitle', { defaultValue: 'System Preferences' })}</h3>
            </div>

            <Accordion
              type="multiple"
              value={expandedItems}
              onValueChange={setExpandedItems}
              className="w-full space-y-4"
            >
              <AIConfiguration />
              <SubscriptionSettings />
              <SchedulerSettings />
              <CalendarConnect />
              <LocationCard />
              <InviteFriendsButton />
              <ShoppingAssistant />
            </Accordion>

            <div className="flex pt-4">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all duration-300"
                onClick={() => { logout(); nav('/login'); }}
                data-testid="settings-logout-button"
              >
                <LogOut className="h-4 w-4 me-2" /> {t('profile.signOut')}
              </Button>
            </div>

            <div className="flex pt-2 justify-center items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if ('ontouchstart' in window) {
                    toast.info(t('profile.mobileDesktopGuide', { defaultValue: 'Wardrobe import is available on the desktop version of DressApp. Please open your account on a desktop browser to continue.' }), { duration: 8000 });
                  } else {
                    setIsMigrationModalOpen(true);
                  }
                }}
                className="text-xs font-semibold bg-slate-900 text-slate-100 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 px-3.5 py-1.5 rounded-full transition-all duration-200 shadow-sm inline-flex items-center gap-1.5 h-8 mt-2"
                data-testid="profile-import-wardrobe-pill"
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>{t('profile.importWardrobePill', { defaultValue: 'Import Wardrobe' })}</span>
              </Button>

              <Link
                to="/delete-account"
                className="text-xs text-muted-foreground hover:text-destructive transition-colors duration-200 mt-2"
                data-testid="delete-account-link"
              >
                {t('profile.deleteAccountLink', { defaultValue: 'Delete my Account' })}
              </Link>
            </div>
            
            <div className="mt-6">
              <DeveloperPanel user={user} />
            </div>
          </CardContent>
        </Card>
      </div>

      <OnboardingMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
      />
    </div>
  );
}


