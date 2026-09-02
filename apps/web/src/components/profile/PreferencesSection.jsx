import { Sliders } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Field } from './primitives.jsx';

export function PreferencesSection({ form, setNested, t, wUnit, lUnit }) {
  return (
    <AccordionItem value="preferences" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-preferences"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(200_80%_93%)] text-[hsl(200_80%_45%)] dark:bg-[hsl(200_30%_18%)] dark:text-[hsl(200_80%_65%)] shrink-0 transition-transform duration-200">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.sections.preferences')} — {t('profile.units')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.sections.preferencesDesc', { defaultValue: 'Default measurement scales for sizes, lengths, and weights' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.unitsWeight')}>
            <Select
              value={wUnit}
              onValueChange={(v) => setNested('units', 'weight', v)}
            >
              <SelectTrigger className="rounded-xl bg-card" data-testid="profile-unit-weight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">{t('profile.unitKg')}</SelectItem>
                <SelectItem value="lb">{t('profile.unitLb')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('profile.unitsLength')}>
            <Select
              value={lUnit}
              onValueChange={(v) => setNested('units', 'length', v)}
            >
              <SelectTrigger className="rounded-xl bg-card" data-testid="profile-unit-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">{t('profile.unitCm')}</SelectItem>
                <SelectItem value="in">{t('profile.unitIn')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}