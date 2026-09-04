import { MapPin, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { CountryCombobox } from '@/components/CountryCombobox';
import { resolveCountry } from '@/lib/countries';
import { Field } from './primitives.jsx';

export function ContactSection({
  form,
  setField,
  setNested,
  setForm,
  t,
  googleConnected,
  syncGoogleProfile,
  syncingGoogle,
}) {
  return (
    <AccordionItem value="contact" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
      <AccordionTrigger
        className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        data-testid="profile-accordion-contact"
      >
        <div className="flex items-center gap-4 text-start w-full">
          <div className="p-2.5 rounded-xl bg-[hsl(174_44%_93%)] text-[hsl(174_44%_33%)] dark:bg-[hsl(174_30%_18%)] dark:text-[hsl(174_44%_60%)] shrink-0 transition-transform duration-200">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
              {t('profile.sections.contact')}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case truncate max-w-[200px]">
              {t('profile.sections.contactDesc', { defaultValue: 'Phone number, delivery address, and localization' })}
            </span>
          </div>
          {googleConnected && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1 rounded-full border-[hsl(var(--accent)/40)] hover:bg-[hsl(var(--accent)/5)] ms-auto shrink-0 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                syncGoogleProfile();
              }}
              disabled={syncingGoogle}
              title={t('profile.googleSyncContactHint')}
            >
              {syncingGoogle ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {t('profile.syncGoogleFromSection', { defaultValue: 'Sync from Google' })}
            </Button>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
        {googleConnected && !(form.phone || form.address.line1 || form.address.city) && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-[hsl(217_91%_97%)] dark:bg-[hsl(217_30%_15%)] border border-[hsl(217_91%_85%)] dark:border-[hsl(217_30%_25%)] mb-3">
            <Sparkles className="h-4 w-4 text-[hsl(217_91%_56%)] shrink-0" />
            <span className="text-xs text-[hsl(217_91%_30%)] dark:text-[hsl(217_91%_75%)]">
              {t('profile.googleConnectedSyncHint', { defaultValue: 'Connected via Google — sync to auto-fill empty fields from your Google profile.' })}
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('profile.phone')} htmlFor="f-phone">
            <Input
              id="f-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder={t('profile.phonePlaceholder')}
              className="rounded-xl bg-card"
              data-testid="profile-field-phone"
            />
          </Field>
          <Field label={t('profile.addressLine1')} htmlFor="f-l1">
            <AddressAutocomplete
              inputId="f-l1"
              kind="street"
              value={form.address.line1}
              onChange={(v) => setNested('address', 'line1', v)}
              onSelect={(addr) => {
                setForm((f) => ({
                  ...f,
                  address: {
                    ...f.address,
                    line1: addr.line1 || f.address.line1,
                    city: addr.city || f.address.city,
                    region: addr.region || f.address.region,
                    postal_code:
                      addr.postal_code || f.address.postal_code,
                    country: addr.country || f.address.country,
                  },
                }));
              }}
              countryCode={resolveCountry(form.address.country)?.code}
              placeholder={t('profile.addressLine1Placeholder', {
                defaultValue: 'Start typing your street…',
              })}
              autoComplete="address-line1"
              testid="profile-field-address_line1"
            />
          </Field>
          <Field label={t('profile.addressLine2')} htmlFor="f-l2">
            <Input
              id="f-l2"
              value={form.address.line2}
              onChange={(e) => setNested('address', 'line2', e.target.value)}
              autoComplete="address-line2"
              className="rounded-xl bg-card"
            />
          </Field>
          <Field label={t('profile.city')} htmlFor="f-city">
            <AddressAutocomplete
              inputId="f-city"
              kind="city"
              value={form.address.city}
              onChange={(v) => setNested('address', 'city', v)}
              onSelect={(addr) => {
                setForm((f) => ({
                  ...f,
                  address: {
                    ...f.address,
                    city: addr.city || f.address.city,
                    region: addr.region || f.address.region,
                    postal_code:
                      addr.postal_code || f.address.postal_code,
                    country: addr.country || f.address.country,
                  },
                }));
              }}
              countryCode={resolveCountry(form.address.country)?.code}
              placeholder={t('profile.cityPlaceholder', {
                defaultValue: 'Start typing your city…',
              })}
              autoComplete="address-level2"
              testid="profile-field-address_city"
            />
          </Field>
          <Field label={t('profile.region')} htmlFor="f-region">
            <Input
              id="f-region"
              value={form.address.region}
              onChange={(e) => setNested('address', 'region', e.target.value)}
              autoComplete="address-level1"
              className="rounded-xl bg-card"
            />
          </Field>
          <Field label={t('profile.postalCode')} htmlFor="f-zip">
            <Input
              id="f-zip"
              value={form.address.postal_code}
              onChange={(e) => setNested('address', 'postal_code', e.target.value)}
              autoComplete="postal-code"
              className="rounded-xl bg-card"
            />
          </Field>
          <Field label={t('profile.country')} htmlFor="f-country">
            <CountryCombobox
              value={form.address.country}
              onChange={(name) =>
                setNested('address', 'country', name)
              }
              placeholder={t('profile.countryPlaceholder', {
                defaultValue: 'Pick or type your country…',
              })}
              testid="profile-field-address_country"
            />
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}