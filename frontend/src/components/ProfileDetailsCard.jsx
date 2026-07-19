import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Camera, Image as ImgIcon, Save, Trash2, Loader2, Sparkles,
  User, MapPin, Fingerprint, Sliders, Ruler, Scissors, Briefcase, CreditCard, Palette, Bell
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CountryCombobox } from '@/components/CountryCombobox';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { resolveCountry } from '@/lib/countries';
import AvatarViewer from './AvatarViewer';

/**
 * Downscale a selected image in-browser before we ship it to Mongo. We cap
 * the long edge to `maxEdge` px and re-encode as JPEG @ q=0.82 — this keeps
 * the stored data URL comfortably under Mongo's 16MB doc ceiling while
 * remaining high enough fidelity for the stylist to read.
 */
async function fileToDataUrl(file, maxEdge = 1280) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_OPTIONS = ['single', 'married', 'divorced', 'widowed'];
const SEX_OPTIONS = ['female', 'male'];
const HAIR_LENGTH = ['short', 'medium', 'long'];
const HAIR_TYPE = ['straight', 'wavy', 'curly', 'coily'];

function PhotoSlot({ label, value, onChange, testid }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await fileToDataUrl(file, 1024);
      onChange(url);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-border p-3 bg-secondary/40"
      data-testid={`profile-photo-${testid}`}
    >
      <div className="caps-label text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-background border border-border shrink-0">
          {value ? (
            <img
              src={value}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">
              <ImgIcon className="h-5 w-5 opacity-60" />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            data-testid={`profile-photo-${testid}-camera-btn`}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Camera className="h-3.5 w-3.5 me-1" /> {t('profile.takePhoto')}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            data-testid={`profile-photo-${testid}-upload-btn`}
          >
            <ImgIcon className="h-3.5 w-3.5 me-1" />
            {value ? t('profile.replacePhoto') : t('profile.uploadPhoto')}
          </Button>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg text-rose-700"
              disabled={busy}
              onClick={() => onChange(null)}
              data-testid={`profile-photo-${testid}-remove-btn`}
            >
              <Trash2 className="h-3.5 w-3.5 me-1" />
              {t('profile.removePhoto')}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        // `capture` is honoured on mobile — opens the camera directly.
        capture="user"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}

function Field({ label, children, htmlFor }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="caps-label text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function ProfileDetailsCard() {
  const { t } = useTranslation();
  const { user, updateUserLocal } = useAuth();
  const nav = useNavigate();

  const initial = useMemo(
    () => ({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      date_of_birth: user?.date_of_birth || '',
      sex: user?.sex || '',
      personal_status: user?.personal_status || '',
      occupation: user?.occupation || '',
      address: {
        line1: user?.address?.line1 || '',
        line2: user?.address?.line2 || '',
        city: user?.address?.city || '',
        region: user?.address?.region || '',
        postal_code: user?.address?.postal_code || '',
        country: user?.address?.country || '',
      },
      units: {
        weight: user?.units?.weight || 'kg',
        length: user?.units?.length || 'cm',
      },
      face_photo_url: user?.face_photo_url || '',
      body_photo_url: user?.body_photo_url || '',
      body_measurements: {
        height: user?.body_measurements?.height || '',
        weight: user?.body_measurements?.weight || '',
        shirt_size: user?.body_measurements?.shirt_size || '',
        shoulders: user?.body_measurements?.shoulders || '',
        chest: user?.body_measurements?.chest || '',
        waist: user?.body_measurements?.waist || '',
        hip: user?.body_measurements?.hip || '',
        sleeve: user?.body_measurements?.sleeve || '',
        pants_size: user?.body_measurements?.pants_size || '',
        inseam: user?.body_measurements?.inseam || '',
        outseam: user?.body_measurements?.outseam || '',
        shoe_size: user?.body_measurements?.shoe_size || '',
        foot_length: user?.body_measurements?.foot_length || '',
        bra_size: user?.body_measurements?.bra_size || '',
        dress_size: user?.body_measurements?.dress_size || '',
      },
      hair: {
        length: user?.hair?.length || '',
        type: user?.hair?.type || '',
        color: user?.hair?.color || '',
        style: user?.hair?.style || '',
      },
      professional: {
        is_professional: !!user?.professional?.is_professional,
        profession: user?.professional?.profession || '',
        approval_status: user?.professional?.approval_status || 'self',
        business: {
          name: user?.professional?.business?.name || '',
          address: user?.professional?.business?.address || '',
          phone: user?.professional?.business?.phone || '',
          email: user?.professional?.business?.email || '',
          website: user?.professional?.business?.website || '',
          description: user?.professional?.business?.description || '',
        },
      },
      paypal_receiver_email: user?.paypal_receiver_email || '',
      aesthetics: (user?.style_profile?.aesthetics || []).join(', '),
      color_palette: (user?.style_profile?.color_palette || []).join(', '),
      avoid: (user?.style_profile?.avoid || []).join(', '),
      dress_conservativeness: user?.cultural_context?.dress_conservativeness || 'moderate',
      scheduler_settings: {
        campaign_notification_prefs: {
          local_fashion_push: user?.scheduler_settings?.campaign_notification_prefs?.local_fashion_push ?? true,
          local_fashion_email: user?.scheduler_settings?.campaign_notification_prefs?.local_fashion_email ?? false,
          sale_alerts: user?.scheduler_settings?.campaign_notification_prefs?.sale_alerts ?? false,
          new_expert_near_me: user?.scheduler_settings?.campaign_notification_prefs?.new_expert_near_me ?? true,
          sustainable_fashion: user?.scheduler_settings?.campaign_notification_prefs?.sustainable_fashion ?? false,
          luxury_promos: user?.scheduler_settings?.campaign_notification_prefs?.luxury_promos ?? false,
          personal_stylist: user?.scheduler_settings?.campaign_notification_prefs?.personal_stylist ?? true,
          notification_frequency: user?.scheduler_settings?.campaign_notification_prefs?.notification_frequency || 'weekly',
          max_campaign_distance_km: user?.scheduler_settings?.campaign_notification_prefs?.max_campaign_distance_km || 10,
        }
      },
    }),
    [user],
  );

  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);

  const isFreshStartInitial = useMemo(() => {
    const m = user?.body_measurements || {};
    const hasCalculated = m.shoulders || m.chest || m.hip || m.sleeve || m.inseam || m.outseam;
    return !hasCalculated;
  }, [user]);

  const [isFreshStart, setIsFreshStart] = useState(isFreshStartInitial);
  const [predicting, setPredicting] = useState(false);
  const [hasPredicted, setHasPredicted] = useState(false);

  // Baseline snapshot used to determine if the form is "dirty". We seed
  // it to `initial` on mount, and re-baseline it after every successful
  // save so the Save button drops back to its disabled state. JSON
  // stringification gives us a deep-equality check without pulling in
  // lodash; the form is plain JSON data with stable key order from the
  // `initial` useMemo above, so the round-trip is deterministic.
  const baselineRef = useRef(JSON.stringify(initial));
  // If `initial` recomputes (e.g. user object changed externally), keep
  // the baseline in step so external updates aren't treated as dirt.
  const lastSeenInitialRef = useRef(initial);
  if (lastSeenInitialRef.current !== initial) {
    lastSeenInitialRef.current = initial;
    baselineRef.current = JSON.stringify(initial);
  }
  const isDirty = JSON.stringify(form) !== baselineRef.current;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (parent, k, v) =>
    setForm((f) => ({ ...f, [parent]: { ...f[parent], [k]: v } }));
  const setCampaignPref = (k, v) =>
    setForm((f) => ({
      ...f,
      scheduler_settings: {
        ...f.scheduler_settings,
        campaign_notification_prefs: {
          ...f.scheduler_settings.campaign_notification_prefs,
          [k]: v,
        },
      },
    }));

  const isFemale = form.sex === 'female';
  const wUnit = form.units.weight === 'lb' ? 'lb' : 'kg';
  const lUnit = form.units.length === 'in' ? 'in' : 'cm';

  const handlePredictMeasurements = async (height, weight, waist, footLength, sex) => {
    let h_cm = parseFloat(height);
    let w_kg = parseFloat(weight);
    let wa_cm = parseFloat(waist);
    let fl_cm = parseFloat(footLength);

    if (isNaN(h_cm) || isNaN(w_kg) || isNaN(wa_cm) || isNaN(fl_cm)) return;

    if (lUnit === 'in') {
      h_cm *= 2.54;
      wa_cm *= 2.54;
      fl_cm *= 2.54;
    }
    if (wUnit === 'lb') {
      w_kg *= 0.45359237;
    }

    setPredicting(true);
    try {
      const res = await api.predictMeasurements({
        height: h_cm,
        weight: w_kg,
        waist: wa_cm,
        foot_length: fl_cm,
        gender: sex === 'male' ? 'male' : 'female'
      });

      const convertVal = (val) => {
        if (lUnit === 'in') {
          return Math.round((val / 2.54) * 10) / 10;
        }
        return Math.round(val * 10) / 10;
      };

      setForm((prev) => ({
        ...prev,
        body_measurements: {
          ...prev.body_measurements,
          shoulders: convertVal(res.shoulders),
          chest: convertVal(res.chest),
          hip: convertVal(res.hip),
          sleeve: convertVal(res.sleeve),
          inseam: convertVal(res.inseam),
          outseam: convertVal(res.outseam),
        },
      }));
      setHasPredicted(true);
    } catch (err) {
      console.error("Prediction failed:", err);
    } finally {
      setPredicting(false);
    }
  };

  const hasFilledBasic = !!(
    form.body_measurements.height &&
    form.body_measurements.weight &&
    form.body_measurements.waist &&
    form.body_measurements.foot_length
  );

  // Auto-trigger prediction when 4 basic inputs are filled (debounced)
  const lastCallRef = useRef('');
  useEffect(() => {
    const { height, weight, waist, foot_length } = form.body_measurements;
    const sex = form.sex || 'female';

    if (!height || !weight || !waist || !foot_length) return;

    // Check if values actually changed to avoid infinite loops or unnecessary requests
    const callSig = `${height}_${weight}_${waist}_${foot_length}_${sex}_${lUnit}_${wUnit}`;
    if (callSig === lastCallRef.current) return;

    const timer = setTimeout(() => {
      lastCallRef.current = callSig;
      handlePredictMeasurements(height, weight, waist, foot_length, sex);
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.body_measurements.height,
    form.body_measurements.weight,
    form.body_measurements.waist,
    form.body_measurements.foot_length,
    form.sex,
    lUnit,
    wUnit
  ]);
  const autofilledFromGoogle =
    !!user?.google_connected &&
    (!!user?.first_name || !!user?.last_name || !!user?.avatar_url);

  const save = async () => {
    setBusy(true);
    try {
      // Strip empty-string values so we don't clobber defaults server-side.
      const prune = (obj) =>
        Object.fromEntries(
          Object.entries(obj).filter(
            ([, v]) => v !== '' && v !== null && v !== undefined,
          ),
        );
      const payload = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        sex: form.sex || null,
        personal_status: form.personal_status || null,
        occupation: form.occupation || null,
        address: prune(form.address),
        units: { weight: wUnit, length: lUnit },
        face_photo_url: form.face_photo_url || null,
        body_photo_url: form.body_photo_url || null,
        body_measurements: prune(form.body_measurements),
        hair: prune(form.hair),
        professional: form.professional.is_professional
          ? {
              is_professional: true,
              profession: form.professional.profession || null,
              approval_status: form.professional.approval_status || 'self',
              business: prune(form.professional.business),
            }
          : { is_professional: false },
        paypal_receiver_email: form.paypal_receiver_email || null,
        style_profile: {
          ...user?.style_profile,
          aesthetics: form.aesthetics ? form.aesthetics.split(',').map((s) => s.trim()).filter(Boolean) : [],
          color_palette: form.color_palette ? form.color_palette.split(',').map((s) => s.trim()).filter(Boolean) : [],
          avoid: form.avoid ? form.avoid.split(',').map((s) => s.trim()).filter(Boolean) : [],
        },
        cultural_context: {
          ...user?.cultural_context,
          dress_conservativeness: form.dress_conservativeness,
        },
        scheduler_settings: {
          ...user?.scheduler_settings,
          campaign_notification_prefs: form.scheduler_settings.campaign_notification_prefs,
        },
      };
      const updated = await api.patchMe(payload);
      updateUserLocal?.(updated);
      // Re-baseline so the Save button correctly disables itself after
      // a successful save — even if the user stays on this page (the
      // nav('/home') below is a UX choice, not a guarantee).
      baselineRef.current = JSON.stringify(form);
      toast.success(t('profile.savedProfile'));
      // Per UX spec: after saving Settings/Profile details, take the
      // user back to Home. The auth context has already been updated
      // via `updateUserLocal`, so Home will reflect the new values.
      nav('/home');
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      className="rounded-[calc(var(--radius)+6px)] shadow-editorial"
      data-testid="profile-details-card"
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="caps-label text-muted-foreground">
              {t('profile.sections.identity')}
            </div>
            <h3 className="font-display text-xl mt-0.5">{t('profile.title')}</h3>
          </div>
          {autofilledFromGoogle && (
            <Badge
              variant="outline"
              className="text-[11px] bg-card rounded-full"
              data-testid="profile-google-autofill-badge"
            >
              <Sparkles className="h-3 w-3 me-1 text-[hsl(var(--accent))]" />
              {t('profile.autofilledFromGoogle')}
            </Badge>
          )}
        </div>

        <Accordion
          type="multiple"
          defaultValue={['identity']}
          className="w-full space-y-4"
        >
          {/* --- Identity --- */}
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
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
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

          {/* --- Contact --- */}
          <AccordionItem value="contact" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
            <AccordionTrigger
              className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              data-testid="profile-accordion-contact"
            >
              <div className="flex items-center gap-4 text-start">
                <div className="p-2.5 rounded-xl bg-[hsl(174_44%_93%)] text-[hsl(174_44%_33%)] dark:bg-[hsl(174_30%_18%)] dark:text-[hsl(174_44%_60%)] shrink-0 transition-transform duration-200">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('profile.sections.contact')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('profile.sections.contactDesc', { defaultValue: 'Phone number, delivery address, and localization' })}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
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
                  {/* Address line 1 (street + house number) — autocompletes
                      via OpenStreetMap Nominatim, biased to the selected
                      country. Picking a suggestion fills line1 + city +
                      region + postal_code in one shot. */}
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
                  {/* City autocomplete — same backend, biased to country. */}
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
                  {/* Static, offline country combobox — type to filter
                      across name (localised + English) and ISO-2 code. */}
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

          {/* --- Demographics --- */}
          <AccordionItem value="demographics" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
            <AccordionTrigger
              className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              data-testid="profile-accordion-demographics"
            >
              <div className="flex items-center gap-4 text-start">
                <div className="p-2.5 rounded-xl bg-[hsl(18_78%_94%)] text-[hsl(18_78%_56%)] dark:bg-[hsl(18_30%_18%)] dark:text-[hsl(18_78%_70%)] shrink-0 transition-transform duration-200">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('profile.sections.demographics')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('profile.sections.demographicsDesc', { defaultValue: 'Gender, occupational background, and personal status' })}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t('profile.sex')}>
                  <Select
                     value={form.sex || ''}
                     onValueChange={(v) => setField('sex', v || '')}
                  >
                    <SelectTrigger
                      className="rounded-xl bg-card"
                      data-testid="profile-field-sex"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEX_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`profile.sex_${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('profile.personalStatus')}>
                  <Select
                    value={form.personal_status || ''}
                    onValueChange={(v) => setField('personal_status', v || '')}
                  >
                    <SelectTrigger
                      className="rounded-xl bg-card"
                      data-testid="profile-field-personal_status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`profile.status_${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {/* Free-text occupation. Distinct from the
                    "Professional" toggle below — that one is a
                    fashion-pro flag for the /experts directory.
                    Occupation is the user's actual day-job (e.g.
                    "marketing manager", "barista", "student") and
                    feeds the Trend-Scout personalization ranker so
                    the home/stylist feeds skew toward content
                    relevant to their working life. */}
                <Field
                  label={t('profile.occupation', { defaultValue: 'Occupation' })}
                  htmlFor="f-occupation"
                >
                  <Input
                    id="f-occupation"
                    value={form.occupation}
                    onChange={(e) => setField('occupation', e.target.value)}
                    placeholder={t('profile.occupationPlaceholder', {
                      defaultValue: 'e.g. Marketing manager, Student, Barista',
                    })}
                    maxLength={80}
                    autoComplete="organization-title"
                    className="rounded-xl bg-card"
                    data-testid="profile-field-occupation"
                  />
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* --- Preferences (units) --- */}
          <AccordionItem value="preferences" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
            <AccordionTrigger
              className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              data-testid="profile-accordion-preferences"
            >
              <div className="flex items-center gap-4 text-start">
                <div className="p-2.5 rounded-xl bg-[hsl(200_80%_93%)] text-[hsl(200_80%_45%)] dark:bg-[hsl(200_30%_18%)] dark:text-[hsl(200_80%_65%)] shrink-0 transition-transform duration-200">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('profile.sections.preferences')} — {t('profile.units')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('profile.sections.preferencesDesc', { defaultValue: 'Default measurement scales for sizes, lengths, and weights' })}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('profile.unitsWeight')}>
                  <Select
                    value={wUnit}
                    onValueChange={(v) => setNested('units', 'weight', v)}
                  >
                    <SelectTrigger className="rounded-xl bg-card" data-testid="profile-unit-weight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">{t('profile.unitKg')}</SelectItem>
                      <SelectItem value="lb">{t('profile.unitLb')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={t('profile.unitsLength')}>
                  <Select
                    value={lUnit}
                    onValueChange={(v) => setNested('units', 'length', v)}
                  >
                    <SelectTrigger className="rounded-xl bg-card" data-testid="profile-unit-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">{t('profile.unitCm')}</SelectItem>
                      <SelectItem value="in">{t('profile.unitIn')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* --- Photos & Avatar --- */}
          <AccordionItem value="photos" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
            <AccordionTrigger
              className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              data-testid="profile-accordion-photos"
            >
              <div className="flex items-center gap-4 text-start">
                <div className="p-2.5 rounded-xl bg-[hsl(320_80%_94%)] text-[hsl(320_80%_56%)] dark:bg-[hsl(320_30%_18%)] dark:text-[hsl(320_80%_70%)] shrink-0 transition-transform duration-200">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('profile.sections.photosAvatar', { defaultValue: 'Photos & Avatar' })}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('profile.sections.photosAvatarDesc', { defaultValue: 'Avatar model visual reference photos and body-render shape' })}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <PhotoSlot
                  label={t('profile.facePhoto')}
                  value={form.face_photo_url}
                  onChange={(v) => setField('face_photo_url', v)}
                  testid="face"
                />
                <div className="rounded-2xl border border-border p-3 bg-card flex flex-col shadow-inner">
                  <div className="caps-label text-muted-foreground mb-2">
                    {t('profile.sections.digitalAvatar', { defaultValue: '3D Digital Avatar' })}
                  </div>
                  <div className="flex-1 w-full rounded-xl overflow-hidden bg-background border border-border min-h-[200px]">
                    <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={form.sex || 'female'} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {t('profile.sections.avatarGenerationDesc', { defaultValue: 'Generated from your body measurements below.' })}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* --- Style Profile --- */}
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
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
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

          {/* --- Measurements --- */}
          <AccordionItem value="measurements" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
            <AccordionTrigger
              className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              data-testid="profile-accordion-measurements"
            >
              <div className="flex items-center gap-4 text-start">
                <div className="p-2.5 rounded-xl bg-[hsl(142_71%_93%)] text-[hsl(142_71%_35%)] dark:bg-[hsl(142_30%_15%)] dark:text-[hsl(142_71%_55%)] shrink-0 transition-transform duration-200">
                  <Ruler className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('profile.sections.measurements')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('profile.sections.measurementsDesc', { defaultValue: 'Garment sizing fits (height, chest, waist, and inseams)' })}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
              <MeasurementsGrid
                form={form}
                onChange={(k, v) => setNested('body_measurements', k, v)}
                wUnit={wUnit}
                lUnit={lUnit}
                isFemale={isFemale}
                isFreshStart={isFreshStart}
                hasFilledBasic={hasFilledBasic}
                predicting={predicting}
                hasPredicted={hasPredicted}
              />
            </AccordionContent>
          </AccordionItem>

          {/* --- Hair --- */}
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
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
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

          {/* --- Professional (Phase U) --- */}
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
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
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

          {/* --- Payouts (Phase 4P) --- */}
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
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
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

          {/* --- Campaign Notifications --- */}
          <AccordionItem value="campaigns" className="border border-border/80 rounded-2xl bg-card overflow-hidden shadow-sm hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-300">
            <AccordionTrigger
              className="hover:no-underline px-5 py-4 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              data-testid="profile-accordion-campaigns"
            >
              <div className="flex items-center gap-4 text-start">
                <div className="p-2.5 rounded-xl bg-[hsl(340_80%_93%)] text-[hsl(340_80%_50%)] dark:bg-[hsl(340_30%_18%)] dark:text-[hsl(340_80%_70%)] shrink-0 transition-transform duration-200">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('campaigns.notifications.sectionTitle')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('campaigns.notifications.sectionSubtitle')}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-3 border-t border-border/40 bg-secondary/5">
              <div className="space-y-4" data-testid="campaign-notif-section">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('campaigns.notifications.frequencyLabel', { defaultValue: 'Frequency' })}>
                    <Select
                      value={form.scheduler_settings.campaign_notification_prefs.notification_frequency}
                      onValueChange={(v) => setCampaignPref('notification_frequency', v)}
                    >
                      <SelectTrigger className="rounded-xl bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instant">{t('campaigns.notifications.freqInstant', { defaultValue: 'Instant' })}</SelectItem>
                        <SelectItem value="daily">{t('campaigns.notifications.freqDaily', { defaultValue: 'Daily' })}</SelectItem>
                        <SelectItem value="weekly">{t('campaigns.notifications.freqWeekly', { defaultValue: 'Weekly' })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('campaigns.notifications.distanceLabel', { defaultValue: 'Max Distance' })}>
                    <Select
                      value={String(form.scheduler_settings.campaign_notification_prefs.max_campaign_distance_km)}
                      onValueChange={(v) => setCampaignPref('max_campaign_distance_km', Number(v))}
                    >
                      <SelectTrigger className="rounded-xl bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 km</SelectItem>
                        <SelectItem value="10">10 km</SelectItem>
                        <SelectItem value="25">25 km</SelectItem>
                        <SelectItem value="50">50 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="space-y-3 mt-4">
                  {[
                    ['local_fashion_push', 'localFashionPush'],
                    ['local_fashion_email', 'localFashionEmail'],
                    ['sale_alerts', 'saleAlerts'],
                    ['new_expert_near_me', 'newExpertNearMe'],
                    ['sustainable_fashion', 'sustainableFashion'],
                    ['luxury_promos', 'luxuryPromos'],
                    ['personal_stylist', 'personalstylist']
                  ].map(([key, i18nKey]) => (
                    <div key={key} className="flex items-start gap-3 rounded-xl border border-border p-3 bg-card shadow-sm">
                      <Switch
                        checked={form.scheduler_settings.campaign_notification_prefs[key]}
                        onCheckedChange={(v) => setCampaignPref(key, !!v)}
                        data-testid={`campaign-toggle-${key}`}
                      />
                      <div className="flex-1 mt-0.5">
                        <div className="font-medium text-sm">
                          {t(`campaigns.notifications.${i18nKey}`)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-end">
          <Button
            onClick={save}
            disabled={busy || !isDirty}
            className="rounded-xl"
            data-testid="profile-details-save-btn"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 me-2" /> {t('profile.saveProfile')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Numeric measurement field. Defined OUTSIDE its parent so React keeps
 * the same component identity across renders — without this, a new
 * function reference would be created on every parent render, React
 * would unmount/remount the input, and the user could only ever type
 * one character before losing focus.
 *
 * Stores the raw string the user typed so partial / decimal-in-progress
 * values like "17" or "1.6" are preserved verbatim. Number coercion
 * happens at save-time on the parent, never on each keystroke.
 */
const MeasurementNumField = ({ field, label, value, onChange, testId, isAi, predicting }) => (
  <Field 
    label={
      <span className="flex items-center gap-1.5">
        {label}
        {isAi && (
          <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/50 py-0 px-1 rounded flex items-center gap-0.5 normal-case font-normal">
            <Sparkles className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
            AI
          </Badge>
        )}
      </span>
    }
  >
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={predicting ? '...' : (value ?? '')}
        onChange={(e) => onChange(field, e.target.value)}
        className={`rounded-xl bg-card transition-all duration-300 ${isAi ? 'border-purple-200/60 focus-visible:ring-purple-400 focus-visible:border-purple-400 dark:border-purple-900/40' : ''}`}
        data-testid={testId}
        disabled={predicting}
      />
      {predicting && (
        <div className="absolute right-3 top-2.5 flex items-center">
          <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
        </div>
      )}
    </div>
  </Field>
);

const MeasurementTextField = ({ field, label, value, onChange, testId }) => (
  <Field label={label}>
    <Input
      autoComplete="off"
      value={value ?? ''}
      onChange={(e) => onChange(field, e.target.value)}
      className="rounded-xl bg-card"
      data-testid={testId}
    />
  </Field>
);

/**
 * Dedicated grid: swaps labelled units, adds female-only rows conditionally.
 */
function MeasurementsGrid({
  form,
  onChange,
  wUnit,
  lUnit,
  isFemale,
  isFreshStart,
  hasFilledBasic,
  predicting,
  hasPredicted
}) {
  const { t } = useTranslation();
  // Tiny helpers so the JSX below stays declarative.
  const num = (field, label, unit = 'len', isAi = false) => (
    <MeasurementNumField
      key={field}
      field={field}
      label={`${label} (${unit === 'wt' ? wUnit : lUnit})`}
      value={form.body_measurements[field]}
      onChange={onChange}
      testId={`profile-measurement-${field}`}
      isAi={isAi}
      predicting={predicting && isAi}
    />
  );
  const txt = (field, label) => (
    <MeasurementTextField
      key={field}
      field={field}
      label={label}
      value={form.body_measurements[field]}
      onChange={onChange}
      testId={`profile-measurement-${field}`}
    />
  );

  const showCalculatedAndOther = !isFreshStart || hasFilledBasic || hasPredicted;

  return (
    <div className="space-y-4">
      {predicting && (
        <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 animate-pulse bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/10">
          <Sparkles className="h-3.5 w-3.5 animate-spin" />
          <span>{t('profile.measurements.calculating', { defaultValue: 'Calculating body shape measurements using AI...' })}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Core Basic Preferences */}
        {num('height', t('profile.measurements.height'))}
        {num('weight', t('profile.measurements.weight'), 'wt')}
        {num('waist', t('profile.measurements.waist'))}
        {num('foot_length', t('profile.measurements.footLength'))}
      </div>

      {showCalculatedAndOther && (
        <>
          <div className="border-t border-border/40 my-2 pt-2">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              {t('profile.measurements.calculatedSection', { defaultValue: 'Calculated Body Dimensions (AI Generated)' })}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 2. Calculated Preferences */}
            {num('shoulders', t('profile.measurements.shoulders'), 'len', true)}
            {num('chest', t('profile.measurements.chest'), 'len', true)}
            {num('hip', t('profile.measurements.hip'), 'len', true)}
            {num('sleeve', t('profile.measurements.sleeve'), 'len', true)}
            {num('inseam', t('profile.measurements.inseam'), 'len', true)}
            {num('outseam', t('profile.measurements.outseam'), 'len', true)}
          </div>

          <div className="border-t border-border/40 my-2 pt-2">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
              {t('profile.measurements.sizesSection', { defaultValue: 'Garment & Footwear Sizes' })}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 3. User-Entered Value Preferences */}
            {txt('shirt_size', t('profile.measurements.shirtSize'))}
            {txt('pants_size', t('profile.measurements.pantsSize'))}
            {txt('shoe_size', t('profile.measurements.shoeSize'))}
            {isFemale && (
              <>
                {txt('bra_size', t('profile.measurements.braSize'))}
                {txt('dress_size', t('profile.measurements.dressSize'))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
