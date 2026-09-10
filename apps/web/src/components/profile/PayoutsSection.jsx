import { Field } from './primitives.jsx'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CreditCard } from 'lucide-react'

export function PayoutsSection({ form, setField, t }) {
  return (
    <AccordionItem value="payouts" className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300">
       <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(150_80%_92%)] text-[hsl(150_80%_35%)] dark:bg-[hsl(150_30%_15%)] dark:text-[hsl(150_80%_60%)] shrink-0 transition-transform duration-200">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-bold block text-dark-brand">
                {t('profile.payouts.sectionTitle')}
              </span>
              {form.paypal_receiver_email && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/20 rounded-full py-0.5 px-2 font-semibold"
                >
                  {t('profile.payouts.linked')}
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.payouts.sectionDesc', { defaultValue: 'Linked PayPal billing address for designer and listing sales' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="space-y-2">
          <div className="text-[12px] font-bold text-text-brand italic">
            {t('profile.payouts.description')}
          </div>
          <Field label={t('profile.payouts.paypalEmail')}>
            <Input
              type="email"
              value={form.paypal_receiver_email}
              onChange={(e) =>
                setField('paypal_receiver_email', e.target.value)
              }
              placeholder={t('components.profileDetailsCard.nameexamplecom')}
              data-testid="profile-paypal-email"
            />
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
