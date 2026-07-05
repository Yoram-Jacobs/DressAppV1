import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LogOut, Loader2, Languages, Bell, Newspaper, Calendar, Users, TrendingUp, Key, Coins, Info, ExternalLink, Save } from 'lucide-react';
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
  const [searchParams] = useSearchParams();
  const [openVal, setOpenVal] = useState(
    searchParams.get('open') === 'scheduler' ? 'scheduler' : undefined
  );

  useEffect(() => {
    if (searchParams.get('open') === 'scheduler') {
      setOpenVal('scheduler');
      setTimeout(() => {
        document.getElementById('scheduler-settings-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [searchParams]);

  const [enabled, setEnabled] = useState(user?.scheduler_settings?.enabled || false);
  const [frequency, setFrequency] = useState(user?.scheduler_settings?.frequency || 'everyday');
  const [weekday, setWeekday] = useState(user?.scheduler_settings?.weekday || 'monday');
  const [time, setTime] = useState(user?.scheduler_settings?.time || '07:00');
  const [styleOption, setStyleOption] = useState(user?.scheduler_settings?.style_option || 'casual');
  const [customStyle, setCustomStyle] = useState(user?.scheduler_settings?.custom_style || '');
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

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
          const res = await api.getVapidKey();
          const pubKey = urlBase64ToUint8Array(res.public_key);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: pubKey,
          });
        }
        await api.subscribeWebPush(sub.toJSON());
        setPushEnabled(true);
        toast.success(t('profile.browserPushNotificationsSuccessfullyEnabled', { defaultValue: 'Browser push notifications successfully enabled.' }));
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await api.unsubscribeWebPush(sub.endpoint);
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
    setSaved(false);
    try {
      const updated = await api.patchMe({
        scheduler_settings: {
          enabled,
          frequency,
          weekday,
          time,
          style_option: styleOption,
          custom_style: customStyle,
          style_dress_for: styleOption === 'custom' ? customStyle : styleOption,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      updateUserLocal(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(t('profile.aiStylistSchedulerSettingsUpdated', { defaultValue: 'AI Stylist Scheduler settings updated.' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.error', { defaultValue: 'Failed to save changes.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="scheduler-settings-section" className="rounded-[calc(var(--radius)+6px)] shadow-editorial" data-testid="scheduler-settings-card">
      <Accordion type="single" collapsible value={openVal} onValueChange={setOpenVal}>
        <AccordionItem value="scheduler" className="border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3 text-start">
              <Bell className="h-5 w-5 text-[hsl(var(--accent))]" />
              <div>
                <div className="caps-label text-muted-foreground">{t('profile.aiStylist', { defaultValue: 'AI Stylist' })}</div>
                <h3 className="font-display text-xl font-semibold m-0">{t('profile.schedulerPushReminders', { defaultValue: 'Scheduler & Push Reminders' })}</h3>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-4 pt-0">
            <Separator />
        
        <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-xl border border-border">
          <div className="space-y-1">
            <div className="font-semibold text-sm">{t('profile.enableSchedulerProposals', { defaultValue: 'Enable Scheduler Proposals' })}</div>
            <div className="text-xs text-muted-foreground text-start">{t('profile.receivePushReminders', { defaultValue: 'Receive customized daily outfit proposals.' })}</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="scheduler-enabled-switch" />
        </div>

        {enabled && (
          <div className="space-y-4 pt-2 text-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-freq">{t('profile.notificationFrequency', { defaultValue: 'Frequency' })}</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="s-freq" className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyday">{t('profile.everyday', { defaultValue: 'Everyday' })}</SelectItem>
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
                <Label htmlFor="s-time">{t('profile.notificationTime', { defaultValue: 'Notification Time' })}</Label>
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
                    <SelectItem value="custom">{t('credits.custom', { defaultValue: 'Custom' })}</SelectItem>
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
              <div className="font-semibold text-sm">{t('profile.browserPushAlerts', { defaultValue: 'Push Alerts' })}</div>
              <div className="text-xs text-muted-foreground text-start">{t('profile.receiveDirectBrowserAlerts', { defaultValue: 'Receive alerts on this device.' })}</div>
            </div>
            <Switch checked={pushEnabled} onCheckedChange={handlePushToggle} disabled={busy} />
          </div>
        )}

        <div className="text-xs text-muted-foreground p-3 bg-secondary/20 rounded-xl border border-dashed border-border/80 text-start">
          {t('profile.phoneWarning', { defaultValue: '* Configure phone number under Identity to receive simulated push alerts.' })}
        </div>

        <div className="flex">
          <Button 
            onClick={save} 
            disabled={busy} 
            className={`rounded-xl transition-all duration-300 ${saved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
            data-testid="scheduler-save-button"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              t('common.saved', { defaultValue: 'Saved!' })
            ) : (
              t('common.save', { defaultValue: 'Save' })
            )}
          </Button>
        </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

const PROVIDERS = [
  { id: 'google_ai', name: 'Google Gemini', defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
  { id: 'openai', name: 'OpenAI ChatGPT', defaultModel: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o'] },
  { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-3-5-haiku', models: ['claude-3-5-haiku', 'claude-3-5-sonnet'] },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'qwen', name: 'Alibaba Qwen', defaultModel: 'qwen-plus', models: ['qwen-plus', 'qwen-max'] }
];

function AIConfigurationCard() {
  const { t, i18n } = useTranslation();
  const { user, updateUserLocal } = useAuth();
  const location = useLocation();
  const isRtl = i18n.dir() === 'rtl';
  
  const [providerMode, setProviderMode] = useState(user?.ai_configuration?.provider_mode || 'standard');
  const [activeProviderId, setActiveProviderId] = useState(user?.ai_configuration?.selected_provider || 'google_ai');
  const [activeModel, setActiveModel] = useState(user?.ai_configuration?.selected_model || 'gemini-2.5-flash');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accordionVal, setAccordionVal] = useState(undefined);

  useEffect(() => {
    if (location.hash === '#ai-configuration-section' || location.state?.scrollTo === 'ai-configuration-section') {
      setAccordionVal('ai-config');
      setTimeout(() => {
        const el = document.getElementById('ai-configuration-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [location]);

  useEffect(() => {
    api.getMe().then((freshUser) => {
      if (freshUser) {
        updateUserLocal(freshUser);
      }
    }).catch(console.error);
  }, [updateUserLocal]);
  
  const currentCredits = user?.ai_configuration?.current_credits ?? 1000;
  const creditsUsed = user?.ai_configuration?.credits_used_this_month ?? 0;
  const creditPrice = 0.005; 
  
  const calculatedFee = (creditsUsed * creditPrice * 0.07).toFixed(4);
  
  const activeProvider = PROVIDERS.find(p => p.id === activeProviderId) || PROVIDERS[0];
  const hasSelectedProviderKey = !!user?.ai_configuration?.custom_keys?.[activeProviderId];

  const handleSaveConfig = async (mode, keyVal = null, providerId = null, modelVal = null) => {
    setBusy(true);
    try {
      const currentConfig = user?.ai_configuration || {};
      const newProviderId = providerId || currentConfig.selected_provider || 'google_ai';
      const newModelVal = modelVal || (providerId ? (PROVIDERS.find(p => p.id === providerId)?.defaultModel || 'gemini-2.5-flash') : (currentConfig.selected_model || 'gemini-2.5-flash'));
      
      const payload = {
        ai_configuration: {
          provider_mode: mode,
          selected_provider: newProviderId,
          selected_model: newModelVal,
          custom_keys: {}
        }
      };
      
      if (mode === 'standard') {
        if (keyVal !== null) {
          payload.ai_configuration.custom_keys.google_ai = keyVal;
        } else {
          payload.ai_configuration.custom_keys.google_ai = true;
        }
      } else if (mode === 'custom_keys') {
        const providersList = ['google_ai', 'openai', 'anthropic', 'deepseek', 'qwen'];
        providersList.forEach(p => {
          if (p === newProviderId && keyVal !== null) {
            payload.ai_configuration.custom_keys[p] = keyVal;
          } else if (currentConfig.custom_keys?.[p]) {
            payload.ai_configuration.custom_keys[p] = true;
          }
        });
      } else {
        payload.ai_configuration.custom_keys = {
          google_ai: "", openai: "", anthropic: "", deepseek: "", qwen: ""
        };
      }
      
      const updatedUser = await api.patchMe(payload);
      updateUserLocal(updatedUser);
      setProviderMode(mode);
      if (providerId) setActiveProviderId(providerId);
      if (newModelVal) setActiveModel(newModelVal);
      toast.success(t('common.success', { defaultValue: 'Settings updated successfully' }));
      setIsModalOpen(false);
      setApiKeyInput('');
    } catch (err) {
      console.error(err);
      toast.error(t('profile.saveFailed', { defaultValue: 'Save failed' }));
    } finally {
      setBusy(false);
    }
  };

  const getStepInstructions = () => {
    switch (activeProviderId) {
      case 'openai':
        return {
          step1: t('profile.aiConfig.stepOpenAI1', { defaultValue: "1. Click 'Get API Key' to visit OpenAI Developer Platform." }),
          step2: t('profile.aiConfig.stepOpenAI2', { defaultValue: "2. Sign in and navigate to API Keys dashboard." }),
          step3: t('profile.aiConfig.stepOpenAI3', { defaultValue: "3. Create a new secret key, copy it, and paste it below." }),
          link: "https://platform.openai.com/api-keys"
        };
      case 'anthropic':
        return {
          step1: t('profile.aiConfig.stepAnthropic1', { defaultValue: "1. Click 'Get API Key' to visit Anthropic Developer Console." }),
          step2: t('profile.aiConfig.stepAnthropic2', { defaultValue: "2. Sign in with your developer account." }),
          step3: t('profile.aiConfig.stepAnthropic3', { defaultValue: "3. Create an API key in settings, copy it, and paste it below." }),
          link: "https://console.anthropic.com/settings/keys"
        };
      case 'deepseek':
        return {
          step1: t('profile.aiConfig.stepDeepSeek1', { defaultValue: "1. Click 'Get API Key' to visit DeepSeek Open Platform." }),
          step2: t('profile.aiConfig.stepDeepSeek2', { defaultValue: "2. Create a developer account and sign in." }),
          step3: t('profile.aiConfig.stepDeepSeek3', { defaultValue: "3. Generate a new API key, copy it, and paste it below." }),
          link: "https://platform.deepseek.com/api_keys"
        };
      case 'qwen':
        return {
          step1: t('profile.aiConfig.stepQwen1', { defaultValue: "1. Click 'Get API Key' to visit Alibaba DashScope Console." }),
          step2: t('profile.aiConfig.stepQwen2', { defaultValue: "2. Login and navigate to API Key Management." }),
          step3: t('profile.aiConfig.stepQwen3', { defaultValue: "3. Copy the key, paste it below, and click Save." }),
          link: "https://dashscope.console.aliyun.com/apiKey"
        };
      case 'google_ai':
      default:
        return {
          step1: t('profile.aiConfig.stepGemini1', { defaultValue: "1. Click 'Get API Key' to visit Google AI Studio." }),
          step2: t('profile.aiConfig.stepGemini2', { defaultValue: "2. Sign in with any Google account and click 'Create API Key'." }),
          step3: t('profile.aiConfig.stepGemini3', { defaultValue: "3. Copy the generated key, paste it below, and click Save." }),
          link: "https://aistudio.google.com/"
        };
    }
  };
  const steps = getStepInstructions();

  return (
    <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial" id="ai-configuration-section">
      <CardContent className="p-6">
        <Accordion type="single" collapsible value={accordionVal} onValueChange={setAccordionVal}>
          <AccordionItem value="ai-config" className="border-none">
            <AccordionTrigger className="py-2 hover:no-underline">
              <div className="flex items-center gap-3 text-start">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    {t('profile.aiConfig.title', { defaultValue: 'AI Configuration' })}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('profile.aiConfig.subtitle', { defaultValue: 'Manage your AI service providers, customize API keys, or switch to edge AI models.' })}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="pt-4 space-y-4 pb-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('profile.aiConfig.modeLabel', { defaultValue: 'AI Provider Mode' })}
                </Label>
                <Select
                  value={providerMode}
                  onValueChange={(val) => handleSaveConfig(val)}
                  disabled={busy}
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  <SelectTrigger className="rounded-xl w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="standard">
                      {t('profile.aiConfig.standardPlan', { defaultValue: 'Standard Plan (Credit-based)' })}
                    </SelectItem>
                    <SelectItem value="custom_keys">
                      {t('profile.aiConfig.customKeys', { defaultValue: 'My Own API Keys (SaaS)' })}
                    </SelectItem>
                    <SelectItem value="on_device">
                      {t('profile.aiConfig.onDevice', { defaultValue: 'On-Device Local AI (Gemma)' })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {providerMode === 'custom_keys' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('profile.aiConfig.providerLabel', { defaultValue: 'Active Provider' })}
                    </Label>
                    <Select
                      value={activeProviderId}
                      onValueChange={(val) => handleSaveConfig(providerMode, null, val)}
                      disabled={busy}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {PROVIDERS.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('profile.aiConfig.modelLabel', { defaultValue: 'Model Preference' })}
                    </Label>
                    <Select
                      value={activeModel}
                      onValueChange={(val) => handleSaveConfig(providerMode, null, null, val)}
                      disabled={busy}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <SelectTrigger className="rounded-xl w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {activeProvider.models.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {(providerMode === 'standard' || providerMode === 'custom_keys') && (
                <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                      {providerMode === 'standard' 
                        ? t('profile.aiConfig.geminiKeyLabel', { defaultValue: 'Google Gemini Key:' }) 
                        : t('profile.aiConfig.providerKeyLabel', { defaultValue: '{{providerName}} Key:', providerName: activeProvider.name })}
                      {((providerMode === 'standard' && !!user?.ai_configuration?.custom_keys?.google_ai) || 
                        (providerMode === 'custom_keys' && hasSelectedProviderKey)) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {t('profile.aiConfig.statusActive', { defaultValue: 'Active' })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          {t('profile.aiConfig.statusInactive', { defaultValue: 'Inactive' })}
                        </span>
                      )}
                    </span>
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="xs" className="rounded-lg text-[10px] h-6">
                          {((providerMode === 'standard' && !!user?.ai_configuration?.custom_keys?.google_ai) || 
                            (providerMode === 'custom_keys' && hasSelectedProviderKey)) 
                            ? t('common.edit', { defaultValue: 'Edit' }) 
                            : t('profile.aiConfig.connectKey', { defaultValue: 'Connect Key' })}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <Key className="h-4 w-4 text-primary" />
                            {providerMode === 'standard'
                              ? t('profile.aiConfig.modelSelectorTitleGemini', { defaultValue: 'Connect Gemini Key' })
                              : t('profile.aiConfig.modelSelectorTitleProvider', { defaultValue: 'Connect {{providerName}} Key', providerName: activeProvider.name })}
                          </DialogTitle>
                          <DialogDescription className="text-xs text-muted-foreground">
                            {t('profile.aiConfig.setupInstructions', { defaultValue: 'Setting up your custom API key is easy! Follow these steps:' })}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-2">
                          <div className="text-xs space-y-2 text-foreground/90 bg-secondary/25 p-3.5 rounded-xl border border-border/40">
                            <p>{steps.step1}</p>
                            <p>{steps.step2}</p>
                            <p>{steps.step3}</p>
                          </div>

                          <div className="flex justify-end">
                            <a 
                              href={steps.link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                            >
                              {t('profile.aiConfig.getKeyBtn', { defaultValue: 'Get API Key' })}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">{t('profile.aiConfig.apiKeyLabel', { defaultValue: 'API Key' })}</Label>
                            <Input 
                              type="password"
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              placeholder={t('profile.aiConfig.keyPlaceholder', { defaultValue: 'Paste your API key here...' })}
                              className="rounded-xl text-xs h-9"
                            />
                          </div>
                          
                          <Button 
                            className="w-full rounded-xl text-xs h-9 font-semibold"
                            onClick={() => handleSaveConfig(providerMode, apiKeyInput, providerMode === 'standard' ? 'google_ai' : activeProviderId)}
                            disabled={busy || !apiKeyInput}
                          >
                            {busy && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                            {t('profile.aiConfig.saveBtn', { defaultValue: 'Save Configuration' })}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {providerMode === 'standard' 
                      ? t('profile.aiConfig.standardInstructions', { defaultValue: 'Configure your own Google Gemini key to run personalized model queries. The standard plan uses Google\'s free-tier developer API quota.' })
                      : t('profile.aiConfig.setupInstructions', { defaultValue: 'Configure your own developer key to run queries directly against your own account quota.' })
                    }
                  </p>
                </div>
              )}

              {providerMode !== 'on_device' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Coins className="h-5 w-5 text-primary/80" />
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {t('profile.aiConfig.creditsLabel', { defaultValue: 'Remaining Credits' })}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {t('profile.aiConfig.creditsUsed', { defaultValue: 'Monthly credit price is $0.005. 7% platform fee is added.' })}
                        </div>
                      </div>
                    </div>
                    <span className="text-base font-bold text-primary">{currentCredits}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Coins className="h-5 w-5 text-amber-500/80" />
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {t('profile.aiConfig.appFeeLabel', { defaultValue: 'Accrued App Fee' })}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {t('profile.aiConfig.appFeeDescription', { defaultValue: 'Unpaid platform fee accrued from credit usage.' })}
                        </div>
                      </div>
                    </div>
                    <span className="text-base font-bold text-amber-600 dark:text-amber-400">${calculatedFee}</span>
                  </div>
                </div>
              )}

              {providerMode === 'on_device' && (
                <div className="p-4 rounded-2xl bg-secondary/40 border border-border/60 flex items-center gap-3">
                  <Info className="h-5 w-5 text-muted-foreground shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    {t('profile.aiConfig.edgeNotice', { defaultValue: 'Running local Gemma4-E2B offline. Execution usage metrics are monitored locally and credited back via Google Nano Banana.' })}
                  </p>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground leading-normal flex items-start gap-1.5 p-1 bg-secondary/15 rounded-lg">
                <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  {t('profile.aiConfig.feeNotice', { defaultValue: 'A 7% platform fee is applied to your credit usage to cover custom technology, layout rendering, and prompt processing.' })}
                  {creditsUsed > 0 && ` Current fee: $${calculatedFee}.`}
                </span>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
    phone: user?.phone || '',
    preferred_language: (user?.preferred_language || i18n.language || 'en').toLowerCase(),
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

  useEffect(() => {
    if (user?.preferred_language) {
      const code = user.preferred_language.toLowerCase();
      setForm((f) => {
        if (f.preferred_language === code) return f;
        return { ...f, preferred_language: code };
      });
    }
  }, [user?.preferred_language]);

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
        phone: form.phone || null,
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
        <AIConfigurationCard />
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
            <Accordion type="multiple" defaultValue={["identity", "style", "context", "voice"]}>
              <AccordionItem value="identity" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="caps-label text-muted-foreground text-start m-0">{t('profile.identity')}</div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 space-y-3 pb-2">
                  <div>
                    <Label>{t('profile.displayName')}</Label>
                    <Input value={form.display_name}
                      onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                      className="rounded-xl" data-testid="settings-display-name" />
                  </div>
                  <div>
                    <Label>{t('profile.phoneNumber', { defaultValue: 'Phone Number' })}</Label>
                    <Input value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder={t('profile.phonePlaceholder', { defaultValue: 'e.g. +1234567890' })}
                      className="rounded-xl" data-testid="settings-phone" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('profile.emailReadonly')}: <span className="font-medium">{user?.email}</span>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="style" className="border-none" data-testid="settings-style-profile">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="caps-label text-muted-foreground text-start m-0">{t('profile.styleProfile')}</div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 space-y-3 pb-2">
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="context" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="caps-label text-muted-foreground text-start m-0">{t('profile.context')}</div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 space-y-3 pb-2">
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="voice" className="border-none">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="caps-label text-muted-foreground text-start m-0">{t('profile.voiceLanguage')}</div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 space-y-3 pb-2">
                  <div>
                    <Label>{t('profile.voice')}</Label>
                    <Select value={form.preferred_voice_id} onValueChange={(v) => setForm({ ...form, preferred_voice_id: v })}>
                      <SelectTrigger className="rounded-xl" data-testid="settings-voice"><SelectValue /></SelectTrigger>
                      <SelectContent>{VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex pt-2">
              <Button type="button" variant="secondary" className="rounded-xl w-full"
                onClick={() => { logout(); nav('/login'); }} data-testid="settings-logout-button">
                <LogOut className="h-4 w-4 me-2" /> {t('profile.signOut')}
              </Button>
            </div>
            
            {/* Floating Save Changes Button */}
            <Button 
              type="submit" 
              disabled={busy} 
              className="fixed bottom-20 end-6 md:bottom-8 md:end-8 z-40 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 rounded-full h-12 w-12 p-0 flex items-center justify-center"
              data-testid="settings-save-button"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            </Button>
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
