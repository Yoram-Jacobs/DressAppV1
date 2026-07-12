import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LogOut, Loader2, Languages, Bell, Newspaper, Calendar, Users, TrendingUp, Key, Coins, Info, ExternalLink, Save, Chrome, Bookmark, Sparkles, Crown } from 'lucide-react';
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

const VOICES = [
  'en_US-ryan-medium',
  'en_US-amy-low',
  'es_ES-carl-medium',
  'fr_FR-gilles-low',
  'de_DE-thorsten-medium',
  'it_IT-riccardo-medium',
  'pt_BR-faber-medium',
  'ru_RU-dmitri-medium',
  'zh_CN-huayan-medium',
  'ja_JP-koko-medium',
  'ar_JO-kareem-low',
  'hi_IN-rohan-medium',
  'he_IL-hebrew-medium',
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

function SchedulerSettingsAccordionItem() {
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
    <AccordionItem
      value="scheduler"
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
      id="scheduler-settings-section"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(343_85%_96%)] text-[hsl(343_85%_58%)] dark:bg-[hsl(343_30%_18%)] dark:text-[hsl(343_85%_72%)] shrink-0 transition-transform duration-200">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.schedulerPushReminders', { defaultValue: 'Scheduler & Push' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {t('profile.schedulerDesc', { defaultValue: 'Daily outfit proposals, push alerts, and scheduling options' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5 space-y-4">
        <div className="flex items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border/70 shadow-sm text-start">
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
                  <SelectTrigger id="s-freq" className="rounded-xl bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
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
                    <SelectTrigger id="s-day" className="rounded-xl bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
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
                <Input id="s-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl bg-card" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-style">{t('profile.styleDressFor', { defaultValue: 'Style / Dress For' })}</Label>
                <Select value={styleOption} onValueChange={setStyleOption}>
                  <SelectTrigger id="s-style" className="rounded-xl bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
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
                    className="rounded-xl bg-card" 
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {pushSupported && (
          <div className="flex items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border/70 shadow-sm text-start">
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

        <div className="flex justify-end pt-2">
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
  );
}

const PROVIDERS = [
  { id: 'google_ai', name: 'Google Gemini', defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
  { id: 'openai', name: 'OpenAI ChatGPT', defaultModel: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o'] },
  { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'claude-3-5-haiku', models: ['claude-3-5-haiku', 'claude-3-5-sonnet'] },
  { id: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'qwen', name: 'Alibaba Qwen', defaultModel: 'qwen-plus', models: ['qwen-plus', 'qwen-max'] }
];

function AIConfigurationAccordionItem() {
  const { t, i18n } = useTranslation();
  const { user, updateUserLocal } = useAuth();
  const isRtl = i18n.dir() === 'rtl';
  
  const [providerMode, setProviderMode] = useState(user?.ai_configuration?.provider_mode || 'standard');
  const [activeProviderId, setActiveProviderId] = useState(user?.ai_configuration?.selected_provider || 'google_ai');
  const [activeModel, setActiveModel] = useState(user?.ai_configuration?.selected_model || 'gemini-2.5-flash');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getMe().then((freshUser) => {
      if (freshUser) {
        updateUserLocal(freshUser);
      }
    }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
    <AccordionItem
      value="ai-config"
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
      id="ai-configuration-section"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(35_92%_95%)] text-[hsl(35_92%_52%)] dark:bg-[hsl(35_30%_18%)] dark:text-[hsl(35_92%_70%)] shrink-0 transition-transform duration-200">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.aiConfig.title', { defaultValue: 'AI Configuration' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {t('profile.aiConfig.subtitle', { defaultValue: 'Manage your AI service providers, customize API keys, or switch to edge AI models.' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5 space-y-4">
        <div className="space-y-2 text-start">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('profile.aiConfig.modeLabel', { defaultValue: 'AI Provider Mode' })}
          </Label>
          <Select
            value={providerMode}
            onValueChange={(val) => handleSaveConfig(val)}
            disabled={busy}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <SelectTrigger className="rounded-xl bg-card w-full">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-start">
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
                <SelectTrigger className="rounded-xl bg-card w-full">
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
                <SelectTrigger className="rounded-xl bg-card w-full">
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
          <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-3 shadow-sm text-start">
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
                  <Button variant="outline" size="xs" className="rounded-lg text-[10px] h-6 bg-secondary/50">
                    {((providerMode === 'standard' && !!user?.ai_configuration?.custom_keys?.google_ai) || 
                      (providerMode === 'custom_keys' && hasSelectedProviderKey)) 
                      ? t('common.edit', { defaultValue: 'Edit' }) 
                      : t('profile.aiConfig.connectKey', { defaultValue: 'Connect Key' })}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md bg-card border border-border shadow-lg">
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
                        className="rounded-xl text-xs h-9 bg-card"
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
            <div className="p-4 rounded-2xl bg-card border border-border/50 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <Coins className="h-5 w-5 text-primary/80" />
                <div className="text-start">
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

            <div className="p-4 rounded-2xl bg-card border border-border/50 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <Coins className="h-5 w-5 text-amber-500/80" />
                <div className="text-start">
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
          <div className="p-4 rounded-2xl bg-card border border-border/60 flex items-center gap-3 text-start shadow-sm">
            <Info className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-normal">
              {t('profile.aiConfig.edgeNotice', { defaultValue: 'Running local Gemma4-E2B offline. Execution usage metrics are monitored locally and credited back via Google Nano Banana.' })}
            </p>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground leading-normal flex items-start gap-1.5 p-1 bg-secondary/15 rounded-lg text-start">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span>
            {t('profile.aiConfig.feeNotice', { defaultValue: 'A 7% platform fee is applied to your credit usage to cover custom technology, layout rendering, and prompt processing.' })}
            {creditsUsed > 0 && ` Current fee: $${calculatedFee}.`}
          </span>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

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
    if (location.hash === '#ai-configuration-section' || location.state?.scrollTo === 'ai-configuration-section') {
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
              <AIConfigurationAccordionItem />
              <SubscriptionSettingsAccordionItem />
              <SchedulerSettingsAccordionItem />
              <CalendarConnect />
              <LocationCard />
              <InviteFriendsButton />
              <ShoppingAssistantAccordionItem />

              {/* --- Voice & Language (Self-contained) --- */}
              <AccordionItem
                value="voice"
                className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
              >
                <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
                  <div className="flex items-center gap-4 text-start">
                    <div className="p-2.5 rounded-xl bg-[hsl(174_44%_93%)] text-[hsl(174_44%_33%)] dark:bg-[hsl(174_30%_18%)] dark:text-[hsl(174_44%_60%)] shrink-0 transition-transform duration-200">
                      <Languages className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                        {t('profile.voiceLanguage', { defaultValue: 'Voice & Language' })}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                        {t('profile.voiceLanguageDesc', { defaultValue: 'Stylist virtual voice and accessibility settings' })}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5 space-y-4">
                  <div className="text-start">
                    <Label htmlFor="preferred-voice">{t('profile.voice', { defaultValue: 'Stylist Voice' })}</Label>
                    <Select value={form.preferred_voice_id} onValueChange={(v) => setForm({ ...form, preferred_voice_id: v })}>
                      <SelectTrigger id="preferred-voice" className="rounded-xl bg-card mt-1.5" data-testid="settings-voice">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={save} 
                      disabled={busy || !isDirty}
                      className="rounded-xl"
                      data-testid="settings-save-button"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 me-2" />}
                      {t('profile.saveProfile', { defaultValue: 'Save Voice Settings' })}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
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
            
            <div className="mt-6">
              <DeveloperPanel user={user} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ShoppingAssistantAccordionItem() {
  const { t, i18n } = useTranslation();

  return (
    <AccordionItem
      value="shopping-assistant"
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(25_90%_95%)] text-[hsl(25_90%_40%)] shrink-0 transition-transform duration-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.shoppingAssistant', { defaultValue: 'Shopping Assistant' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {t('profile.shoppingAssistantDesc', { defaultValue: 'Integrate size recommendations directly into your shopping browser' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5 space-y-5 text-start">
        
        {/* Part 1: Chrome Extension Store Placeholder */}
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Chrome className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-sm">{t('profile.chromeStoreTitle', { defaultValue: 'Chrome Web Store Extension' })}</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('profile.chromeStoreDesc', { defaultValue: 'Get the official browser extension for automatic sizing on supported online stores.' })}
          </p>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border">
              {t('profile.chromeStoreComingSoon', { defaultValue: 'Coming Soon to the Chrome Web Store' })}
            </span>
          </div>
        </div>

        {/* Part 2: Universal Bookmarklet */}
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-emerald-600" />
            <h4 className="font-semibold text-sm">{t('profile.bookmarkletTitle', { defaultValue: 'Universal Bookmarklet' })}</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('profile.bookmarkletDesc', { defaultValue: "Drag the button below to your bookmarks bar. On mobile, add it to your bookmarks and name it 'DressApp Shopping Assistant'. Click it when on any product page." })}
          </p>
          
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <a
              ref={(el) => {
                if (el) {
                  el.setAttribute('href', "javascript:(function(){if(!document.getElementById('dressapp-mobile-styles')){var s=document.createElement('script');s.src='https://dressapp.co/widget/dressapp-mobile-floater.js?t='+Date.now();document.body.appendChild(s);}})();");
                }
              }}
              title="DressApp Shopping Assistant"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors cursor-grab"
              onClick={(e) => {
                // If clicked, trigger alert instruction on how to add to bookmark
                e.preventDefault();
                alert(t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." }));
              }}
            >
              {t('profile.bookmarkletBtn', { defaultValue: 'DressApp Assistant' })}
            </a>
            <span className="text-[11px] text-muted-foreground italic">
              {t('profile.bookmarkletInstruction', { defaultValue: "To use: Drag this button to your bookmarks bar. Click it on any store product page to get size recommendations." })}
            </span>
          </div>
        </div>

      </AccordionContent>
    </AccordionItem>
  );
}


function SubscriptionSettingsAccordionItem() {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const { total: closetCount } = useClosetStore();
  const [busy, setBusy] = useState(false);

  const sub = user?.subscription || {};
  const isActive = sub.is_active || false;
  const planType = sub.plan_type || 'free';
  const expiresAt = sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '';

  const capacity = 150 + (user?.closet_capacity_bonus || 0);

  const handleUpgrade = async (type) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.createSubscription({
        plan_type: type,
        return_url: `${window.location.origin}/me?sub_status=success`,
        cancel_url: `${window.location.origin}/me?sub_status=cancel`,
      });
      if (res.approve_url) {
        window.location.href = res.approve_url;
      } else {
        toast.error('Failed to initiate subscription payment.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail?.message || 'Error creating subscription');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (busy) return;
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose premium features.')) return;
    setBusy(true);
    try {
      await api.cancelSubscription();
      toast.success('Subscription cancelled successfully.');
      await refresh();
    } catch (err) {
      toast.error('Failed to cancel subscription.');
    } finally {
      setBusy(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const subStatus = searchParams.get('sub_status');
    const token = searchParams.get('token');
    if (subStatus === 'success' && token) {
      const capture = async () => {
        setBusy(true);
        try {
          await api.captureSubscription(token);
          toast.success('Subscription activated successfully! Welcome to DressApp Pro.');
          await refresh();
          searchParams.delete('sub_status');
          searchParams.delete('token');
          setSearchParams(searchParams);
        } catch (err) {
          toast.error('Error activating subscription.');
        } finally {
          setBusy(false);
        }
      };
      capture();
    } else if (subStatus === 'cancel') {
      toast.info('Subscription checkout cancelled.');
      searchParams.delete('sub_status');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, refresh]);

  return (
    <AccordionItem
      value="subscription"
      className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300"
    >
      <AccordionTrigger className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(47_95%_90%)] text-[hsl(47_95%_40%)] dark:bg-[hsl(47_30%_18%)] dark:text-[hsl(47_95%_70%)] shrink-0 transition-transform duration-200">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.subscription', { defaultValue: 'Subscription & Limits' })}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
              {isActive 
                ? `Active: ${planType.toUpperCase()} plan (Expires: ${expiresAt})`
                : `Free Plan: ${closetCount} / ${capacity} items used`
              }
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5 space-y-4">
        {isActive ? (
          <div className="space-y-3 text-start">
            <div className="p-4 rounded-xl border border-[hsl(47_95%_80%)] bg-[hsl(47_95%_97%)] dark:bg-[hsl(47_30%_12%)] dark:border-[hsl(47_30%_25%)] flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                  <Crown className="h-4 w-4 text-[hsl(47_95%_50%)]" /> DressApp Pro ({planType.toUpperCase()})
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Renewal date: {expiresAt}
                </p>
              </div>
              <Badge className="bg-[hsl(47_95%_45%)] text-white dark:bg-[hsl(47_95%_35%)]">Active</Badge>
            </div>
            
            <p className="text-xs text-muted-foreground">
              You have unlimited closet slots and fast GPU image segmentation enabled.
            </p>

            <div className="pt-2 flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-xl"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                Cancel Subscription
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-start">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-foreground font-medium mb-1">
                <span>Closet Capacity</span>
                <span>{closetCount} / {capacity} items</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, (closetCount / capacity) * 100)}%` }}
                />
              </div>
              {closetCount >= capacity && (
                <p className="text-xs text-destructive font-medium mt-1">
                  You have reached your closet limit. Upgrade to add more garments!
                </p>
              )}
            </div>

            <Separator className="my-2" />

            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              <div className="border border-border rounded-2xl p-4 bg-card flex flex-col justify-between hover:shadow-sm transition-shadow">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Monthly Plan</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Flexible monthly cycle, cancel anytime.
                  </p>
                  <div className="my-3">
                    <span className="text-2xl font-extrabold text-foreground">$4.99</span>
                    <span className="text-xs text-muted-foreground"> / month</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleUpgrade('monthly')} 
                  disabled={busy}
                  className="rounded-xl w-full"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                  Upgrade Monthly
                </Button>
              </div>

              <div className="border border-[hsl(47_95%_60%)] rounded-2xl p-4 bg-card flex flex-col justify-between hover:shadow-sm transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[hsl(47_95%_45%)] text-white text-[9px] font-bold uppercase tracking-wider py-1 px-3 rounded-bl-xl">
                  Best Value
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1">
                    <Crown className="h-3.5 w-3.5 text-[hsl(47_95%_50%)]" /> Annual Plan
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Save 50% compared to monthly billing.
                  </p>
                  <div className="my-3">
                    <span className="text-2xl font-extrabold text-foreground">$29.99</span>
                    <span className="text-xs text-muted-foreground"> / year</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleUpgrade('yearly')} 
                  disabled={busy}
                  className="rounded-xl w-full bg-[hsl(47_95%_45%)] hover:bg-[hsl(47_95%_40%)] text-white"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                  Upgrade Annual
                </Button>
              </div>
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
