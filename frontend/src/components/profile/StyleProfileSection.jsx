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
    <AccordionItem value="style" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-style"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(210_80%_95%)] text-[hsl(210_80%_45%)] dark:bg-[hsl(210_30%_18%)] dark:text-[hsl(210_80%_65%)] shrink-0 transition-transform duration-200">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.styleProfile')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.styleProfileDesc', { defaultValue: 'Aesthetics, color palette preferences, things to avoid, and conservativeness' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('profile.aesthetics')} htmlFor="f-aesthetics">
            <Input
              id="f-aesthetics"
              value={form.aesthetics}
              onChange={(e) => setField('aesthetics', e.target.value)}
              placeholder={t('profile.aestheticsPlaceholder')}
              className="rounded-xl bg-card"
              data-testid="settings-aesthetics"
            />
          </Field>
          <Field label={t('profile.colorPalette')} htmlFor="f-palette">
            <Input
              id="f-palette"
              value={form.color_palette}
              onChange={(e) => setField('color_palette', e.target.value)}
              placeholder={t('profile.colorPalettePlaceholder')}
              className="rounded-xl bg-card"
              data-testid="settings-palette"
            />
          </Field>
          <Field label={t('profile.avoid')} htmlFor="f-avoid">
            <Input
              id="f-avoid"
              value={form.avoid}
              onChange={(e) => setField('avoid', e.target.value)}
              placeholder={t('profile.avoidPlaceholder')}
              className="rounded-xl bg-card"
              data-testid="settings-avoid"
            />
          </Field>
          <Field label={t('profile.conservativeness')}>
            <Select
              value={form.dress_conservativeness}
              onValueChange={(v) => setField('dress_conservativeness', v)}
            >
              <SelectTrigger className="rounded-xl bg-card" data-testid="settings-conservativeness">
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