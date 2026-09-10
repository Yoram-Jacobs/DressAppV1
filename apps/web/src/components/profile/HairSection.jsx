import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Scissors } from 'lucide-react';
import { Field } from './primitives.jsx';

const HAIR_LENGTH = ['short', 'medium', 'long'];
const HAIR_TYPE = ['straight', 'wavy', 'curly', 'coily'];

export function HairSection({ form, setNested, t }) {
  return (
    <AccordionItem value="hair" className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300">
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(38_90%_92%)] text-[hsl(38_90%_45%)] dark:bg-[hsl(38_30%_18%)] dark:text-[hsl(38_90%_65%)] shrink-0 transition-transform duration-200">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.sections.hair')}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.sections.hairDesc', { defaultValue: 'Hair length, type, style, and color properties' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('profile.hairFields.length')}>
            <Select
              value={form.hair.length || ''}
              onValueChange={(v) => setNested('hair', 'length', v)}
            >
              <SelectTrigger data-testid="profile-hair-length">
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
              <SelectTrigger data-testid="profile-hair-type">
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
              data-testid="profile-hair-color"
            />
          </Field>
          <Field label={t('profile.hairFields.style')}>
            <Input
              value={form.hair.style}
              onChange={(e) => setNested('hair', 'style', e.target.value)}
              data-testid="profile-hair-style"
            />
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
