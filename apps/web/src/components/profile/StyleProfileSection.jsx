import { Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Field } from './primitives.jsx';

export function StyleProfileSection({ form, setField, t }) {
  return (
    <AccordionItem value="style" className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300">
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(210_80%_95%)] text-[hsl(210_80%_45%)] dark:bg-[hsl(210_30%_18%)] dark:text-[hsl(210_80%_65%)] shrink-0 transition-transform duration-200">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.styleProfile')}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.styleProfileDesc', { defaultValue: 'Aesthetics, color palette preferences, things to avoid, and conservativeness' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('profile.aesthetics')} htmlFor="f-aesthetics">
            <Input
              id="f-aesthetics"
              value={form.aesthetics}
              onChange={(e) => setField('aesthetics', e.target.value)}
              placeholder={t('profile.aestheticsPlaceholder')}
              data-testid="settings-aesthetics"
            />
          </Field>
          <Field label={t('profile.colorPalette')} htmlFor="f-palette">
            <Input
              id="f-palette"
              value={form.color_palette}
              onChange={(e) => setField('color_palette', e.target.value)}
              placeholder={t('profile.colorPalettePlaceholder')}
              data-testid="settings-palette"
            />
          </Field>
          <Field label={t('profile.avoid')} htmlFor="f-avoid">
            <Input
              id="f-avoid"
              value={form.avoid}
              onChange={(e) => setField('avoid', e.target.value)}
              placeholder={t('profile.avoidPlaceholder')}
              data-testid="settings-avoid"
            />
          </Field>
          <Field label={t('profile.conservativeness')}>
            <Select
              value={form.dress_conservativeness}
              onValueChange={(v) => setField('dress_conservativeness', v)}
            >
              <SelectTrigger data-testid="settings-conservativeness">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t('profile.conservLow')}</SelectItem>
                <SelectItem value="moderate">{t('profile.conservModerate')}</SelectItem>
                <SelectItem value="high">{t('profile.conservHigh')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}