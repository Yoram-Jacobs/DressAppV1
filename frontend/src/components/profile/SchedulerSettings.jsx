import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Bell, Loader2 } from 'lucide-react';
import { labelForDressCode } from '@/lib/taxonomy';

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

export function SchedulerSettings() {
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
          {t('profile.phoneWarning', { defaultValue: '* Configure phone number under CONTACT to receive push alerts.' })}
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
