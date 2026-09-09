import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Field } from './primitives.jsx';

export function IdentitySection({ form, setField, setNested, t, user }) {
  return (
    <AccordionItem value="identity" className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300">
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(271_81%_95%)] text-[hsl(271_81%_56%)] dark:bg-[hsl(271_30%_18%)] dark:text-[hsl(271_81%_70%)] shrink-0 transition-transform duration-200">
            <User className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[13px] font-bold block text-dark-brand">
              {t('profile.sections.identity')}
            </span>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.sections.identityDesc', { defaultValue: 'Your name, email address, and date of birth' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-3 pb-0 mt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-0 gap-x-3">
          <div>
            <Label htmlFor="f-first">{t('profile.firstName')}</Label>
            <Input
              id="f-first"
              value={form.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              data-testid="profile-field-first_name"
            />
          </div>
          <div>
            <Label htmlFor="f-last">{t('profile.lastName')} </Label>
            <Input
              id="f-last"
              value={form.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              data-testid="profile-field-last_name"
            />
          </div>
          <div>
            <Label>{t('profile.email')}</Label>
            <Input
              value={user?.email || ''}
              readOnly
              data-testid="profile-field-email"
            />
          </div>
          <div>
            <Label htmlFor="f-dob">{t('profile.dob')}</Label>
            <Input
              id="f-dob"
              type="date"
              value={form.date_of_birth || ''}
              onChange={(e) => setField('date_of_birth', e.target.value)}
              data-testid="profile-field-date_of_birth"
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}