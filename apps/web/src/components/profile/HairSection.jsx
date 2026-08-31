import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Scissors } from 'lucide-react';
import { Field } from './primitives.jsx';

const HAIR_LENGTH = ['short', 'medium', 'long'];
const HAIR_TYPE = ['straight', 'wavy', 'curly', 'coily'];

export function HairSection({ form, setNested, t }) {
  return (
    <AccordionItem value="hair" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-hair"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(38_90%_92%)] text-[hsl(38_90%_45%)] dark:bg-[hsl(38_30%_18%)] dark:text-[hsl(38_90%_65%)] shrink-0 transition-transform duration-200">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.sections.hair')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.sections.hairDesc', { defaultValue: 'Hair length, type, style, and color properties' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.hairFields.length')}>
            <Select
              value={form.hair.length || ''}
              onValueChange={(v) => setNested('hair', 'length', v)}
            >
              <SelectTrigger className="rounded-xl bg-card" data-testid="profile-hair-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HAIR_LENGTH.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`profile.hairFields.length_${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('profile.hairFields.type')}>
            <Select
              value={form.hair.type || ''}
              onValueChange={(v) => setNested('hair', 'type', v)}
            >
              <SelectTrigger className="rounded-xl bg-card" data-testid="profile-hair-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HAIR_TYPE.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`profile.hairFields.type_${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('profile.hairFields.color')}>
            <Input
              value={form.hair.color}
              onChange={(e) => setNested('hair', 'color', e.target.value)}
              className="rounded-xl bg-card"
              data-testid="profile-hair-color"
            />
          </Field>
          <Field label={t('profile.hairFields.style')}>
            <Input
              value={form.hair.style}
              onChange={(e) => setNested('hair', 'style', e.target.value)}
              className="rounded-xl bg-card"
              data-testid="profile-hair-style"
            />
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
