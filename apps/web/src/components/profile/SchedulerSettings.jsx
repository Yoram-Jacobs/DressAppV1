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
import { Bell, Loader2, X, Plus } from 'lucide-react';
import { labelForDressCode } from '@/lib/taxonomy';
import { useClosetStore } from '@/lib/useClosetStore';
import { Badge } from '@/components/ui/badge';

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
  const [selectedTags, setSelectedTags] = useState(() => {
    const fromSched = user?.scheduler_settings?.selected_tags;
    if (Array.isArray(fromSched) && fromSched.length > 0) return fromSched;
    if (user?.scheduler_settings?.style_option === 'tags' && user?.scheduler_settings?.custom_style) {
      return user.scheduler_settings.custom_style.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  });
  const [tagDraft, setTagDraft] = useState('');

  // Sync state whenever user.scheduler_settings updates/loads
  useEffect(() => {
    if (!user?.scheduler_settings) return;
    const sched = user.scheduler_settings;
    if (sched.enabled !== undefined) setEnabled(Boolean(sched.enabled));
    if (sched.frequency) setFrequency(sched.frequency);
    if (sched.weekday) setWeekday(sched.weekday);
    if (sched.time) setTime(sched.time);
    if (sched.style_option) setStyleOption(sched.style_option);
    if (sched.custom_style !== undefined) setCustomStyle(sched.custom_style || '');

    const fromSched = sched.selected_tags;
    if (Array.isArray(fromSched) && fromSched.length > 0) {
      setSelectedTags(fromSched);
    } else if (sched.style_option === 'tags' && sched.custom_style) {
      setSelectedTags(sched.custom_style.split(',').map(s => s.trim()).filter(Boolean));
    } else if (sched.style_option === 'tags' && Array.isArray(fromSched) && fromSched.length === 0) {
      setSelectedTags([]);
    }
  }, [user?.scheduler_settings]);

  const { items: closetItems } = useClosetStore({ prewarm: true });
  const availableClosetTags = React.useMemo(() => {
    const tagsSet = new Set();
    (closetItems || []).forEach(it => {
      (it?.tags || []).forEach(t => {
        const tr = String(t || '').trim();
        if (tr) tagsSet.add(tr);
      });
      (it?.custom_tags || []).forEach(t => {
        const tr = String(t || '').trim();
        if (tr) tagsSet.add(tr);
      });
    });
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
  }, [closetItems]);

  const addTag = (tagToAdd) => {
    const raw = String(tagToAdd || tagDraft).trim();
    if (!raw) return;
    const pieces = raw.split(',').map(s => s.trim()).filter(Boolean);
    setSelectedTags(prev => {
      const next = [...prev];
      pieces.forEach(p => {
        if (!next.some(t => t.toLowerCase() === p.toLowerCase())) {
          next.push(p);
        }
      });
      return next;
    });
    setTagDraft('');
  };

  const removeTag = (tagToRemove) => {
    setSelectedTags(prev => prev.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase()));
  };
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
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error(t('profile.pushNotSupported', { defaultValue: 'Push notifications are not supported on this device/browser.' }));
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      if (checked) {
        if ('Notification' in window && Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            toast.error(t('profile.pushPermissionDenied', { defaultValue: 'Notification permission was not granted by your browser.' }));
            return;
          }
        }
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const res = await api.getVapidKey();
          if (!res?.public_key) {
            throw new Error('VAPID public key unavailable on server');
          }
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
      console.error('[handlePushToggle] error:', err);
      toast.error(err?.response?.data?.detail || err?.message || t('profile.failedToTogglePushNotifications', { defaultValue: 'Failed to toggle push notifications.' }));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      // If user typed in tagDraft without hitting Enter or +, capture it now
      let currentTags = [...selectedTags];
      if (styleOption === 'tags' && tagDraft.trim()) {
        const drafts = tagDraft.split(',').map(s => s.trim()).filter(Boolean);
        drafts.forEach(d => {
          if (!currentTags.some(t => t.toLowerCase() === d.toLowerCase())) {
            currentTags.push(d);
          }
        });
        setSelectedTags(currentTags);
        setTagDraft('');
      }

      const tagsStr = currentTags.join(', ');
      const effectiveCustom = styleOption === 'tags' ? tagsStr : customStyle;
      const effectiveDressFor = styleOption === 'custom' ? customStyle : styleOption === 'tags' ? tagsStr : styleOption;

      const updated = await api.patchMe({
        scheduler_settings: {
          ...(user?.scheduler_settings || {}),
          enabled,
          frequency,
          weekday,
          time,
          style_option: styleOption,
          custom_style: effectiveCustom,
          selected_tags: styleOption === 'tags' ? currentTags : (Array.isArray(user?.scheduler_settings?.selected_tags) ? user.scheduler_settings.selected_tags : []),
          style_dress_for: effectiveDressFor,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
      });
      updateUserLocal(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(t('profile.aiStylistSchedulerSettingsUpdated', { defaultValue: 'AI Stylist Scheduler settings updated.' }));
    } catch (err) {
      console.error('[SchedulerSettings] save error:', err);
      toast.error(err?.response?.data?.detail || err?.message || t('common.error', { defaultValue: 'Failed to save changes.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AccordionItem
      value="scheduler"
      className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300"
      id="scheduler-settings-section"
    >
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(343_85%_96%)] text-[hsl(343_85%_58%)] dark:bg-[hsl(343_30%_18%)] dark:text-[hsl(343_85%_72%)] shrink-0 transition-transform duration-200">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.schedulerPushReminders', { defaultValue: 'Scheduler & Push' })}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.schedulerDesc', { defaultValue: 'Daily outfit proposals, push alerts, and scheduling options' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="flex items-center justify-between gap-3 p-3 bg-yellow-shadow rounded-[12px] border border-border shadow-sm text-start">
          <div className="space-y-1">
            <div className="font-semibold text-[14px] text-dark-brand">{t('profile.enableSchedulerProposals', { defaultValue: 'Enable Scheduler Proposals' })}</div>
            <div className="text-[12px] text-text-brand font-semibold text-start">{t('profile.receivePushReminders', { defaultValue: 'Receive customized daily outfit proposals.' })}</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="scheduler-enabled-switch" />
        </div>
        {enabled && (
          <div className="space-y-3 text-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="">
                <Label htmlFor="s-freq">{t('profile.notificationFrequency', { defaultValue: 'Frequency' })}</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="s-freq"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyday">{t('profile.everyday', { defaultValue: 'Everyday' })}</SelectItem>
                    <SelectItem value="every_other_day">{t('profile.everyOtherDay', { defaultValue: 'Every Other Day' })}</SelectItem>
                    <SelectItem value="twice_a_week">{t('profile.twiceAWeek', { defaultValue: 'Twice a Week' })}</SelectItem>
                    <SelectItem value="on_weekday">{t('profile.onWeekday', { defaultValue: 'On Weekday' })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {frequency === 'on_weekday' && (
                <div className="">
                  <Label htmlFor="s-day">{t('profile.chooseDay', { defaultValue: 'Choose Day' })}</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger id="s-day"><SelectValue /></SelectTrigger>
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
              <div className="">
                <Label htmlFor="s-time">{t('profile.notificationTime', { defaultValue: 'Notification Time' })}</Label>
                <Input id="s-time" type="time" value={time} onChange={(e) => setTime(e.target.value)}/>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="">
                <Label htmlFor="s-style">{t('profile.styleDressFor', { defaultValue: 'Style / Dress For' })}</Label>
                <Select value={styleOption} onValueChange={setStyleOption}>
                  <SelectTrigger id="s-style"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">{labelForDressCode('casual', t)}</SelectItem>
                    <SelectItem value="smart-casual">{labelForDressCode('smart-casual', t)}</SelectItem>
                    <SelectItem value="formal">{labelForDressCode('formal', t)}</SelectItem>
                    <SelectItem value="athletic">{labelForDressCode('athletic', t)}</SelectItem>
                    <SelectItem value="tags">{labelForDressCode('tags', t)}</SelectItem>
                    <SelectItem value="custom">{t('credits.custom', { defaultValue: 'Custom' })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {styleOption === 'custom' && (
                <div className="">
                  <Label htmlFor="s-custom-style">{t('profile.dressForDemands', { defaultValue: 'Dress For Demands' })}</Label>
                  <Input
                    id="s-custom-style"
                    value={customStyle}
                    onChange={(e) => setCustomStyle(e.target.value)}
                    placeholder={t('profile.customStylePlaceholder', { defaultValue: 'e.g. Gym, Hiking, Church' })}
                  />
                </div>
              )}
              {styleOption === 'tags' && (
                <div className="space-y-2">
                  <Label htmlFor="s-tag-input">{t('profile.selectOrWriteTags', { defaultValue: 'Select or write tags' })}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="s-tag-input"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder={t('profile.tagsPlaceholder', { defaultValue: 'Type a tag and press Enter (e.g. Work, Summer, Solid)' })}
                      data-testid="scheduler-tag-input"
                    />
                    {tagDraft.trim() && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addTag()}
                        className="rounded-lg px-3"
                        data-testid="scheduler-add-tag-btn"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Selected Tags Badges */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 bg-primary-brand/15 text-primary-brand border border-primary-brand/30"
                        >
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-destructive hover:scale-110 transition-transform"
                            aria-label={`Remove ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Available Closet Tags Chips */}
                  {availableClosetTags.filter(t => !selectedTags.some(st => st.toLowerCase() === t.toLowerCase())).length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] text-text-brand font-medium mb-1.5">
                        {t('profile.availableTags', { defaultValue: 'From your closet:' })}
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                        {availableClosetTags
                          .filter(t => !selectedTags.some(st => st.toLowerCase() === t.toLowerCase()))
                          .map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => addTag(tag)}
                              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary/10 hover:bg-primary-brand/20 hover:text-primary-brand text-muted-foreground border border-border/80 transition-colors inline-flex items-center gap-1"
                            >
                              <Plus className="h-2.5 w-2.5 opacity-60" />
                              {tag}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {pushSupported && (
          <div className="flex items-center justify-between gap-3 p-3 bg-yellow-shadow rounded-[12px] border border-border shadow-sm text-start">
            <div className="space-y-1">
              <div className="font-semibold text-[14px] text-dark-brand">{t('profile.browserPushAlerts', { defaultValue: 'Push Alerts' })}</div>
              <div className="text-[12px] text-text-brand font-semibold text-start">{t('profile.receiveDirectBrowserAlerts', { defaultValue: 'Receive alerts on this device.' })}</div>
            </div>
            <Switch checked={pushEnabled} onCheckedChange={handlePushToggle} disabled={busy} />
          </div>
        )}
        <div className="text-[12px] text-text-brand p-3 bg-white rounded-full border border-primary-brand text-start">
          {t('profile.phoneWarning', { defaultValue: '* Configure phone number under CONTACT to receive push alerts.' })}
        </div>
        <div className="flex justify-end">
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
