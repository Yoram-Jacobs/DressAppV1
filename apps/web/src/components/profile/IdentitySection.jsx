import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Field } from './primitives.jsx';

export function IdentitySection({ form, setField, setNested, t, user }) {
  return (
    <AccordionItem value="identity" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-identity"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(271_81%_95%)] text-[hsl(271_81%_56%)] dark:bg-[hsl(271_30%_18%)] dark:text-[hsl(271_81%_70%)] shrink-0 transition-transform duration-200">
            <User className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.sections.identity')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.sections.identityDesc', { defaultValue: 'Your name, email address, and date of birth' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('profile.firstName')} htmlFor="f-first">
            <Input
              id="f-first"
              value={form.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              className="rounded-xl bg-card"
              data-testid="profile-field-first_name"
            />
          </Field>
          <Field label={t('profile.lastName')} htmlFor="f-last">
            <Input
              id="f-last"
              value={form.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              className="rounded-xl bg-card"
              data-testid="profile-field-last_name"
            />
          </Field>
          <Field label={t('profile.email')}>
            <Input
              value={user?.email || ''}
              readOnly
              className="rounded-xl bg-secondary/40 cursor-not-allowed text-muted-foreground"
              data-testid="profile-field-email"
            />
          </Field>
          <Field label={t('profile.dob')} htmlFor="f-dob">
            <Input
              id="f-dob"
              type="date"
              value={form.date_of_birth || ''}
              onChange={(e) => setField('date_of_birth', e.target.value)}
              className="rounded-xl bg-card"
              data-testid="profile-field-date_of_birth"
            />
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}