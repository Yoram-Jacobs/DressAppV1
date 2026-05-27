import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LogOut, Loader2, Languages, Bell } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { CalendarConnect } from '@/components/CalendarConnect';
import { LocationCard } from '@/components/LocationCard';
import { InviteFriendsButton } from '@/components/InviteFriendsButton';
import { ProfileDetailsCard } from '@/components/ProfileDetailsCard';
import { DeveloperPanel } from '@/components/DeveloperPanel';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { labelForDressCode } from '@/lib/taxonomy';

const VOICES = [
  'aura-2-thalia-en', 'aura-2-hermes-en', 'aura-2-electra-en',
  'aura-2-apollo-en', 'aura-2-draco-en', 'aura-2-hyperion-en',
];

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const getWeekdayName = (day, locale) => {
  const days = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0
  };
  const date = new Date(2026, 4, 24 + days[day.toLowerCase()]); // May 24, 2026 is a Sunday (0).
  return new Intl.DateTimeFormat(locale || 'en', { weekday: 'long' }).format(date);
};

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function SchedulerSettingsCard() {
  const { t, i18n } = useTranslation();
  const { user, updateUserLocal } = useAuth();
  const [enabled, setEnabled] = useState(user?.scheduler_settings?.enabled || false);
  const [frequency, setFrequency] = useState(user?.scheduler_settings?.frequency || 'everyday');
  const [weekday, setWeekday] = useState(user?.scheduler_settings?.weekday || 'monday');
  const [time, setTime] = useState(user?.scheduler_settings?.time || '07:00');
  const [styleOption, setStyleOption] = useState(user?.scheduler_settings?.style_option || 'casual');
  const [customStyle, setCustomStyle] = useState(user?.scheduler_settings?.custom_style || '');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, []);

  const handlePushToggle = async (checked) => {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (checked) {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const res = await api.getWebPushVapidKey();
          const pubKey = urlBase64ToUint8Array(res.public_key);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: pubKey,
          });
        }
        await api.webpushSubscribe(sub.toJSON());
        setPushEnabled(true);
        toast.success(t('profile.browserPushNotificationsSuccessfullyEnabled', { defaultValue: 'Browser push notifications successfully enabled.' }));
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await api.webpushUnsubscribe(sub.endpoint);
        }
        setPushEnabled(false);
        toast.success(t('profile.browserPushNotificationsDisabled', { defaultValue: 'Browser push notifications disabled.' }));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('profile.failedToTogglePushNotifications', { defaultValue: 'Failed to toggle push notifications.' }));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.patchMe({
        scheduler_settings: {
          enabled,
          frequency,
          weekday,
          time,
          style_option: styleOption,
          custom_style: customStyle,
        },
      });
      updateUserLocal(updated);
      toast.success(t('profile.aiStylistSchedulerSettingsUpdated', { defaultValue: 'AI Stylist Scheduler settings updated.' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.error', 'Failed to save changes.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial" data-testid="scheduler-settings-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-[hsl(var(--accent))]" />
          <div>
            <div className="caps-label text-muted-foreground">{t('profile.aiStylist', 'AI Stylist')}</div>
            <h3 className="font-display text-xl font-semibold">{t('profile.schedulerPushReminders', { defaultValue: 'Scheduler & Push Reminders' })}</h3>
          </div>
        </div>
        <Separator />
        
        <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-xl border border-border">
          <div className="space-y-1">
            <div className="font-semibold text-sm">{t('profile.enableSchedulerProposals', { defaultValue: 'Enable Scheduler Proposals' })}</div>
            <div className="text-xs text-muted-foreground text-left">{t('profile.receivePushReminders', { defaultValue: 'Receive push notification reminders with customized outfit proposals.' })}</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="scheduler-enabled-switch" />
        </div>

        {enabled && (
          <div className="space-y-4 pt-2 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-freq">{t('profile.notificationFrequency', { defaultValue: 'Notification Frequency' })}</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="s-freq" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyday">{t('pages.admin.daily_utc', 'Everyday').split(' ')[0].replace(':', '')}</SelectItem>
                    <SelectItem value="every_other_day">{t('profile.everyOtherDay', { defaultValue: 'Every Other Day' })}</SelectItem>
                    <SelectItem value="twice_a_week">{t('profile.twiceAWeek', { defaultValue: 'Twice a Week' })}</SelectItem>
                    <SelectItem value="on_weekday">{t('profile.onWeekday', { defaultValue: 'On Weekday' })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {frequency === 'on_weekday' && (
                <div className="space-y-1.5">
                  <Label htmlFor="s-day">{t('profile.chooseDay', { defaultValue: 'Choose Day' })}</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger id="s-day" className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day} value={day}>
                          {getWeekdayName(day, i18n.language)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="s-time">{t('profile.notificationTime', { defaultValue: 'Notification Time (UTC)' })}</Label>
                <Input id="s-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-style">{t('profile.styleDressFor', { defaultValue: 'Style / Dress For' })}</Label>
                <Select value={styleOption} onValueChange={setStyleOption}>
                  <SelectTrigger id="s-style" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">{labelForDressCode('casual', t)}</SelectItem>
                    <SelectItem value="smart-casual">{labelForDressCode('smart-casual', t)}</SelectItem>
                    <SelectItem value="formal">{labelForDressCode('formal', t)}</SelectItem>
                    <SelectItem value="athletic">{labelForDressCode('athletic', t)}</SelectItem>
                    <SelectItem value="custom">{t('credits.custom', 'Custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {styleOption === 'custom' && (
                <div className="space-y-1.5">
                  <Label htmlFor="s-custom-style">{t('profile.dressForDemands', { defaultValue: 'Dress For Demands' })}</Label>
                  <Input 
                    id="s-custom-style" 
                    value={customStyle} 
                    onChange={(e) => setCustomStyle(e.target.value)} 
                    placeholder={t('profile.customStylePlaceholder', { defaultValue: 'e.g. Gym, Hiking, Church' })} 
                    className="rounded-xl" 
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {pushSupported && (
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-xl border border-border">
            <div className="space-y-1">
              <div className="font-semibold text-sm">{t('profile.browserPushAlerts', { defaultValue: 'Browser Push Alerts (Native Web Push)' })}</div>
              <div className="text-xs text-muted-foreground text-left">{t('profile.receiveDirectBrowserAlerts', { defaultValue: 'Receive direct browser notification alerts on this device.' })}</div>
            </div>
            <Switch checked={pushEnabled} onCheckedChange={handlePushToggle} disabled={busy} />
          </div>
        )}

        <div className="text-xs text-muted-foreground p-3 bg-secondary/20 rounded-xl border border-dashed border-border/80 text-left">
          {t('profile.phoneWarningStart', { defaultValue: '* Ensure your phone number is configured under the ' })}
          <strong>{t('profile.identity', 'Identity')}</strong>
          {t('profile.phoneWarningEnd', { defaultValue: ' section to successfully route simulated push alerts.' })}
        </div>

        <div className="flex">
          <Button onClick={save} disabled={busy} className="rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save', 'Save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, updateUserLocal, logout } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    preferred_language: user?.preferred_language || i18n.language || 'en',
    preferred_voice_id: user?.preferred_voice_id || 'aura-2-thalia-en',
    home_city: user?.home_location?.city || '',
    home_lat: user?.home_location?.lat ?? '',
    home_lng: user?.home_location?.lng ?? '',
    aesthetics: (user?.style_profile?.aesthetics || []).join(', '),
    color_palette: (user?.style_profile?.color_palette || []).join(', '),
    avoid: (user?.style_profile?.avoid || []).join(', '),
    region: user?.cultural_context?.region || '',
    dress_conservativeness: user?.cultural_context?.dress_conservativeness || 'moderate',
  });
  const [busy, setBusy] = useState(false);
  const [langBusy, setLangBusy] = useState(false);

  // Apply language immediately on selection + persist via API.
  const onLanguageChange = async (code) => {
    setForm((f) => ({ ...f, preferred_language: code }));
    setLangBusy(true);
    try {
      await i18n.changeLanguage(code);
      try { localStorage.setItem('dressapp.lang', code); } catch { /* ignore */ }
      const res = await api.patchMe({ preferred_language: code });
      updateUserLocal(res);
      toast.success(t('profile.languageUpdated'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('profile.saveFailed'));
    } finally {
      setLangBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        display_name: form.display_name || null,
        preferred_language: form.preferred_language,
        preferred_voice_id: form.preferred_voice_id,
        style_profile: {
          aesthetics: form.aesthetics.split(',').map((s) => s.trim()).filter(Boolean),
          color_palette: form.color_palette.split(',').map((s) => s.trim()).filter(Boolean),
          avoid: form.avoid.split(',').map((s) => s.trim()).filter(Boolean),
        },
        cultural_context: {
          region: form.region || null,
          dress_conservativeness: form.dress_conservativeness,
        },
      };
      if (form.home_city || form.home_lat || form.home_lng) {
        body.home_location = {
          city: form.home_city || null,
          lat: form.home_lat === '' ? null : Number(form.home_lat),
          lng: form.home_lng === '' ? null : Number(form.home_lng),
        };
      }
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
        <SchedulerSettingsCard />
      </div>

      <div className="mb-6">
        <CalendarConnect />
      </div>

      <div className="mb-6">
        <LocationCard />
      </div>

      <div className="mb-6">
        <InviteFriendsButton />
      </div>

      <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial">
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-6" data-testid="settings-form">
            <section className="space-y-3">
              <div className="caps-label text-muted-foreground">{t('profile.identity')}</div>
              <div>
                <Label>{t('profile.displayName')}</Label>
                <Input value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="rounded-xl" data-testid="settings-display-name" />
              </div>
              <div className="text-xs text-muted-foreground">
                {t('profile.emailReadonly')}: <span className="font-medium">{user?.email}</span>
              </div>
            </section>

            <Separator />

            <section className="space-y-3" data-testid="settings-style-profile">
              <div className="caps-label text-muted-foreground">{t('profile.styleProfile')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t('profile.aesthetics')}</Label>
                  <Input value={form.aesthetics} onChange={(e) => setForm({ ...form, aesthetics: e.target.value })}
                    placeholder={t('profile.aestheticsPlaceholder')} className="rounded-xl" data-testid="settings-aesthetics" />
                </div>
                <div>
                  <Label>{t('profile.colorPalette')}</Label>
                  <Input value={form.color_palette} onChange={(e) => setForm({ ...form, color_palette: e.target.value })}
                    placeholder={t('profile.colorPalettePlaceholder')} className="rounded-xl" data-testid="settings-palette" />
                </div>
                <div className="md:col-span-2">
                  <Label>{t('profile.avoid')}</Label>
                  <Input value={form.avoid} onChange={(e) => setForm({ ...form, avoid: e.target.value })}
                    placeholder={t('profile.avoidPlaceholder')} className="rounded-xl" data-testid="settings-avoid" />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="caps-label text-muted-foreground">{t('profile.context')}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>{t('profile.homeCity')}</Label>
                  <Input value={form.home_city} onChange={(e) => setForm({ ...form, home_city: e.target.value })}
                    className="rounded-xl" data-testid="settings-home-city" />
                </div>
                <div>
                  <Label>{t('profile.latitude')}</Label>
                  <Input value={form.home_lat} onChange={(e) => setForm({ ...form, home_lat: e.target.value })}
                    className="rounded-xl" data-testid="settings-home-lat" />
                </div>
                <div>
                  <Label>{t('profile.longitude')}</Label>
                  <Input value={form.home_lng} onChange={(e) => setForm({ ...form, home_lng: e.target.value })}
                    className="rounded-xl" data-testid="settings-home-lng" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>{t('profile.region')}</Label>
                  <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="rounded-xl" data-testid="settings-region" placeholder={t('profile.regionPlaceholder')} />
                </div>
                <div>
                  <Label>{t('profile.conservativeness')}</Label>
                  <Select value={form.dress_conservativeness} onValueChange={(v) => setForm({ ...form, dress_conservativeness: v })}>
                    <SelectTrigger className="rounded-xl" data-testid="settings-conservativeness"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('profile.conservLow')}</SelectItem>
                      <SelectItem value="moderate">{t('profile.conservModerate')}</SelectItem>
                      <SelectItem value="high">{t('profile.conservHigh')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="caps-label text-muted-foreground">{t('profile.voiceLanguage')}</div>
              <div>
                <Label>{t('profile.voice')}</Label>
                <Select value={form.preferred_voice_id} onValueChange={(v) => setForm({ ...form, preferred_voice_id: v })}>
                  <SelectTrigger className="rounded-xl" data-testid="settings-voice"><SelectValue /></SelectTrigger>
                  <SelectContent>{VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </section>

            <div className="flex gap-3">
              <Button type="submit" disabled={busy} className="rounded-xl" data-testid="settings-save-button">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('profile.saveChanges')}
              </Button>
              <Button type="button" variant="secondary" className="rounded-xl ms-auto"
                onClick={() => { logout(); nav('/login'); }} data-testid="settings-logout-button">
                <LogOut className="h-4 w-4 me-2" /> {t('profile.signOut')}
              </Button>
            </div>
          </form>

          {/*
            Admin-only Developer panel. Renders nothing for non-admin
            users (gate is inside the component) so this block is safe
            to leave unconditionally mounted.
          */}
          <div className="mt-6">
            <DeveloperPanel user={user} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
