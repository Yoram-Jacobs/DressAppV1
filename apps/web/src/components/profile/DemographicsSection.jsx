import { Fingerprint } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Field } from './primitives.jsx';

const STATUS_OPTIONS = ['single', 'married', 'divorced', 'widowed'];
const SEX_OPTIONS = ['female', 'male'];

export function DemographicsSection({ form, setField, t, googleConnected, syncGoogleProfile, syncingGoogle }) {
  return (
    <AccordionItem value="demographics" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-demographics"
      >
        <div className="flex items-center gap-4 text-start w-full">
          <div className="p-2.5 rounded-xl bg-[hsl(18_78%_94%)] text-[hsl(18_78%_56%)] dark:bg-[hsl(18_30%_18%)] dark:text-[hsl(18_78%_70%)] shrink-0 transition-transform duration-200">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.sections.demographics')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.sections.demographicsDesc', { defaultValue: 'Gender, occupational background, and personal status' })}
            </span>
          </div>
          {googleConnected && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 rounded-full border-[hsl(var(--accent)/40)] hover:bg-[hsl(var(--accent)/5)] ms-auto shrink-0 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                syncGoogleProfile();
              }}
              disabled={syncingGoogle}
              title={t('profile.googleSyncDemographicsHint')}
            >
              {syncingGoogle ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {t('profile.syncGoogleFromSection', { defaultValue: 'Sync from Google' })}
            </Button>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('profile.sex')}>
            <Select
               value={form.sex || ''}
               onValueChange={(v) => setField('sex', v || '')}
             >
               <SelectTrigger
                 className="rounded-xl bg-card"
                 data-testid="profile-field-sex"
               >
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {SEX_OPTIONS.map((s) => (
                   <SelectItem key={s} value={s}>
                     {t(`profile.sex_${s}`)}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </Field>
          <Field label={t('profile.personalStatus')}>
            <Select
              value={form.personal_status || ''}
              onValueChange={(v) => setField('personal_status', v || '')}
            >
              <SelectTrigger
                className="rounded-xl bg-card"
                data-testid="profile-field-personal_status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`profile.status_${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t('profile.occupation', { defaultValue: 'Occupation' })}
            htmlFor="f-occupation"
          >
            <Input
              id="f-occupation"
              value={form.occupation}
              onChange={(e) => setField('occupation', e.target.value)}
              placeholder={t('profile.occupationPlaceholder', {
                defaultValue: 'e.g. Marketing manager, Student, Barista',
              })}
              maxLength={80}
              autoComplete="organization-title"
              className="rounded-xl bg-card"
              data-testid="profile-field-occupation"
            />
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
