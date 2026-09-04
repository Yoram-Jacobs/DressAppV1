import { Field } from './primitives.jsx'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CreditCard } from 'lucide-react'

export function PayoutsSection({ form, setField, t }) {
  return (
    <AccordionItem value="payouts" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-payouts"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(150_80%_92%)] text-[hsl(150_80%_35%)] dark:bg-[hsl(150_30%_15%)] dark:text-[hsl(150_80%_60%)] shrink-0 transition-transform duration-200">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
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
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.payouts.sectionDesc', { defaultValue: 'Linked PayPal billing address for designer and listing sales' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-3 bg-card text-xs text-muted-foreground shadow-sm">
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
              className="rounded-xl bg-card"
              data-testid="profile-paypal-email"
            />
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
