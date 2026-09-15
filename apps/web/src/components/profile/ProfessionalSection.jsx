import { Briefcase, Sparkles } from 'lucide-react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './primitives.jsx';

export function ProfessionalSection({ form, setField, t }) {
  return (
    <AccordionItem value="professional" className="p-3 border border-border rounded-[12px] bg-white overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] hover:border-primary-brand hover:bg-primary-shadow transition-all duration-300">
      <AccordionTrigger className="hover:no-underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none py-0">
        <div className="flex items-center gap-4 text-start">
          <div className="p-2.5 rounded-xl bg-[hsl(220_80%_93%)] text-[hsl(220_80%_50%)] dark:bg-[hsl(220_30%_18%)] dark:text-[hsl(220_80%_70%)] shrink-0 transition-transform duration-200">
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-bold block text-dark-brand">
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
            <span className="text-[11px] text-text-brand font-semibold block normal-case">
              {t('profile.professional.sectionDesc', { defaultValue: 'Business approval credentials and professional directory listings' })}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border space-y-3 pt-4 pb-0 mt-3">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[12px] border border-border p-3 bg-yellow-shadow">
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
              <div className="font-bold text-[12px] text-dark-brand">
                {t('profile.professional.checkboxLabel')}
              </div>
              <div className="text-[12px] font-semibold text-text-brand">
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
                  data-testid="profile-professional-business-description"
                />
              </Field>
              <div className="text-[12px] font-semibold italic text-text-brand">
                <Sparkles className="inline h-3 w-3 me-1 text-primary-brand" />
                {t('profile.professional.visibilityNote')}
              </div>
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
