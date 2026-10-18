import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { prune } from '@/lib/formUtils';
import { geocodeContactAddress } from '@/lib/location';

export function useSaveProfile(form, isDirty, baselineRef, t) {
  const { user, updateUserLocal } = useAuth();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const wUnit = form.units.weight === 'lb' ? 'lb' : 'kg';
      const lUnit = form.units.length === 'in' ? 'in' : 'cm';
      const addressData = prune(form.address) || {};

      let homeLocPatch = undefined;
      if (addressData.city || addressData.line1 || addressData.country) {
        try {
          const geocoded = await geocodeContactAddress(addressData);
          if (geocoded?.coords) {
            homeLocPatch = {
              lat: geocoded.coords.lat,
              lng: geocoded.coords.lng,
              city: geocoded.city || addressData.city || null,
              country: geocoded.country || addressData.country || null,
              country_code: geocoded.country_code || null,
              updated_at: new Date().toISOString(),
            };
            addressData.lat = geocoded.coords.lat;
            addressData.lng = geocoded.coords.lng;
            if (geocoded.country_code) addressData.country_code = geocoded.country_code;
          }
        } catch {
          /* ignore geocode errors on save */
        }
      }

      const payload = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        sex: form.sex || null,
        personal_status: form.personal_status || null,
        occupation: form.occupation || null,
        address: Object.keys(addressData).length > 0 ? addressData : null,
        ...(homeLocPatch ? { home_location: homeLocPatch } : {}),
        units: { weight: wUnit, length: lUnit },
        face_photo_url: form.face_photo_url || null,
        body_photo_url: form.body_photo_url || null,
        skin_tone: form.skin_tone || null,
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
          campaign_notification_prefs: form.scheduler_settings?.campaign_notification_prefs,
        },
      };
      const updated = await api.patchMe(payload);
      updateUserLocal?.(updated);
      baselineRef.current = JSON.stringify(form);
      toast.success(t('profile.savedProfile'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('profile.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return { save, busy };
}