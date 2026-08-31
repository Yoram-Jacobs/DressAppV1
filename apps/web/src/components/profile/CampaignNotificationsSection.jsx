import { Bell } from 'lucide-react';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from './primitives.jsx';

export function CampaignNotificationsSection({ form, setCampaignPref, t }) {
  return (
    <AccordionItem value="campaigns" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-campaigns"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(340_80%_93%)] text-[hsl(340_80%_50%)] dark:bg-[hsl(340_30%_18%)] dark:text-[hsl(340_80%_70%)] shrink-0 transition-transform duration-200">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('campaigns.notifications.sectionTitle')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('campaigns.notifications.sectionSubtitle')}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="space-y-4" data-testid="campaign-notif-section">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('campaigns.notifications.frequencyLabel', { defaultValue: 'Frequency' })}>
              <Select
                value={form.scheduler_settings.campaign_notification_prefs.notification_frequency}
                onValueChange={(v) => setCampaignPref('notification_frequency', v)}
              >
                <SelectTrigger className="rounded-xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">{t('campaigns.notifications.freqInstant', { defaultValue: 'Instant' })}</SelectItem>
                  <SelectItem value="daily">{t('campaigns.notifications.freqDaily', { defaultValue: 'Daily' })}</SelectItem>
                  <SelectItem value="weekly">{t('campaigns.notifications.freqWeekly', { defaultValue: 'Weekly' })}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('campaigns.notifications.distanceLabel', { defaultValue: 'Max Distance' })}>
              <Select
                value={String(form.scheduler_settings.campaign_notification_prefs.max_campaign_distance_km)}
                onValueChange={(v) => setCampaignPref('max_campaign_distance_km', Number(v))}
              >
                <SelectTrigger className="rounded-xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">{t('campaigns.notifications.distanceValue', { defaultValue: '{{distance}} km', distance: 5 })}</SelectItem>
                  <SelectItem value="10">{t('campaigns.notifications.distanceValue', { defaultValue: '{{distance}} km', distance: 10 })}</SelectItem>
                  <SelectItem value="25">{t('campaigns.notifications.distanceValue', { defaultValue: '{{distance}} km', distance: 25 })}</SelectItem>
                  <SelectItem value="50">{t('campaigns.notifications.distanceValue', { defaultValue: '{{distance}} km', distance: 50 })}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="space-y-3 mt-4">
            {[
              ['local_fashion_push', 'localFashionPush'],
              ['local_fashion_email', 'localFashionEmail'],
              ['sale_alerts', 'saleAlerts'],
              ['new_expert_near_me', 'newExpertNearMe'],
              ['sustainable_fashion', 'sustainableFashion'],
              ['luxury_promos', 'luxuryPromos'],
              ['personal_stylist', 'personalstylist']
            ].map(([key, i18nKey]) => (
              <div key={key} className="flex items-start gap-3 rounded-xl border border-border p-3 bg-card shadow-sm">
                <Switch
                  checked={form.scheduler_settings.campaign_notification_prefs[key]}
                  onCheckedChange={(v) => setCampaignPref(key, !!v)}
                  data-testid={'campaign-toggle-' + key}
                />
                <div className="flex-1 mt-0.5">
                  <div className="font-medium text-sm">
                    {t('campaigns.notifications.' + i18nKey)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}