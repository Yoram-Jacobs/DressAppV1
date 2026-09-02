import { Briefcase, Sparkles } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './primitives.jsx';

export function ProfessionalSection({ form, setField, t }) {
  return (
    <AccordionItem value="professional" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-professional"
      >
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(220_80%_93%)] text-[hsl(220_80%_50%)] dark:bg-[hsl(220_30%_18%)] dark:text-[hsl(220_80%_70%)] shrink-0 transition-transform duration-200">
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                {t('profile.professional.sectionTitle')}
              </span>
              {form.professional.is_professional && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/20 rounded-full py-0.5 px-2 font-semibold"
                >
                  {t('ads.status_active')}
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.professional.sectionDesc', { defaultValue: 'Business approval credentials and professional directory listings' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-border p-3 bg-card shadow-sm">
            <Switch
              checked={form.professional.is_professional}
              onCheckedChange={(v) =>
                setField('professional', {
                  ...form.professional,
                  is_professional: !!v,
                })
              }
              data-testid="profile-professional-toggle"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">
                {t('profile.professional.checkboxLabel')}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {t('profile.professional.checkboxHint')}
              </div>
            </div>
            {form.professional.approval_status === 'hidden' && (
              <Badge
                variant="outline"
                className="bg-card text-[10px] rounded-full border-rose-400/40 text-rose-700"
              >
                {t('profile.professional.hiddenBadge')}
              </Badge>
            )}
          </div>

          {form.professional.is_professional && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t('profile.professional.profession')}>
                  <Input
                    value={form.professional.profession}
                    onChange={(e) =>
                      setField('professional', {
                        ...form.professional,
                        profession: e.target.value,
                      })
                    }
                    placeholder={t(
                      'profile.professional.professionPlaceholder',
                    )}
                    className="rounded-xl bg-card"
                    data-testid="profile-professional-profession"
                  />
                </Field>
                <Field label={t('profile.professional.businessName')}>
                  <Input
                    value={form.professional.business.name}
                    onChange={(e) =>
                      setField('professional', {
                        ...form.professional,
                        business: {
                          ...form.professional.business,
                          name: e.target.value,
                        },
                      })
                    }
                    className="rounded-xl bg-card"
                    data-testid="profile-professional-business-name"
                  />
                </Field>
                <Field label={t('profile.professional.businessAddress')}>
                  <Input
                    value={form.professional.business.address}
                    onChange={(e) =>
                      setField('professional', {
                        ...form.professional,
                        business: {
                          ...form.professional.business,
                          address: e.target.value,
                        },
                      })
                    }
                    className="rounded-xl bg-card"
                    data-testid="profile-professional-business-address"
                  />
                </Field>
                <Field label={t('profile.professional.businessPhone')}>
                  <Input
                    type="tel"
                    value={form.professional.business.phone}
                    onChange={(e) =>
                      setField('professional', {
                        ...form.professional,
                        business: {
                          ...form.professional.business,
                          phone: e.target.value,
                        },
                      })
                    }
                    className="rounded-xl bg-card"
                    data-testid="profile-professional-business-phone"
                  />
                </Field>
                <Field label={t('profile.professional.businessEmail')}>
                  <Input
                    type="email"
                    value={form.professional.business.email}
                    onChange={(e) =>
                      setField('professional', {
                        ...form.professional,
                        business: {
                          ...form.professional.business,
                          email: e.target.value,
                        },
                      })
                    }
                    className="rounded-xl bg-card"
                    data-testid="profile-professional-business-email"
                  />
                </Field>
                <Field label={t('profile.professional.businessWebsite')}>
                  <Input
                    type="url"
                    placeholder={t('components.profileDetailsCard.https')}
                    value={form.professional.business.website}
                    onChange={(e) =>
                      setField('professional', {
                        ...form.professional,
                        business: {
                          ...form.professional.business,
                          website: e.target.value,
                        },
                      })
                    }
                    className="rounded-xl bg-card"
                    data-testid="profile-professional-business-website"
                  />
                </Field>
              </div>
              <Field label={t('profile.professional.businessDescription')}>
                <Textarea
                  rows={3}
                  value={form.professional.business.description}
                  onChange={(e) =>
                    setField('professional', {
                      ...form.professional,
                      business: {
                        ...form.professional.business,
                        description: e.target.value,
                      },
                    })
                  }
                  className="rounded-xl bg-card"
                  data-testid="profile-professional-business-description"
                />
              </Field>
              <div className="text-xs text-muted-foreground">
                <Sparkles className="inline h-3 w-3 me-1 text-[hsl(var(--accent))]" />
                {t('profile.professional.visibilityNote')}
              </div>
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
