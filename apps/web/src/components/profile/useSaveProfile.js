import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { prune } from '@/lib/formUtils';
import { geocodeContactAddress } from '@/lib/location';

export function useSaveProfile(form, isDirty, baselineRef, t) {
  const { user, updateUserLocal } = useAuth();
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const formRef = useRef(form);
  formRef.current = form;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const saveTimeoutRef = useRef(null);
  const resetSavedTimeoutRef = useRef(null);
  const lastSavedAddressJsonRef = useRef(
    JSON.stringify(form?.address || user?.address || {})
  );

  const save = useCallback(
    async ({ silent = true } = {}) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      const currentForm = formRef.current;
      setBusy(true);
      setSaveStatus('saving');
      try {
        const wUnit = currentForm.units?.weight === 'lb' ? 'lb' : 'kg';
        const lUnit = currentForm.units?.length === 'in' ? 'in' : 'cm';
        const addressData = prune(currentForm.address) || {};

        let homeLocPatch = undefined;
        const currentAddrJson = JSON.stringify(addressData);
        if (
          currentAddrJson !== lastSavedAddressJsonRef.current &&
          (addressData.city || addressData.line1 || addressData.country)
        ) {
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
            lastSavedAddressJsonRef.current = currentAddrJson;
          } catch {
            /* ignore geocode errors on save */
          }
        }

        const payload = {
          first_name: currentForm.first_name || null,
          last_name: currentForm.last_name || null,
          phone: currentForm.phone || null,
          date_of_birth: currentForm.date_of_birth || null,
          sex: currentForm.sex || null,
          personal_status: currentForm.personal_status || null,
          occupation: currentForm.occupation || null,
          address: Object.keys(addressData).length > 0 ? addressData : null,
          ...(homeLocPatch ? { home_location: homeLocPatch } : {}),
          units: { weight: wUnit, length: lUnit },
          face_photo_url: currentForm.face_photo_url || null,
          body_photo_url: currentForm.body_photo_url || null,
          skin_tone: currentForm.skin_tone || null,
          body_measurements: prune(currentForm.body_measurements),
          hair: prune(currentForm.hair),
          professional: currentForm.professional?.is_professional
            ? {
                is_professional: true,
                profession: currentForm.professional.profession || null,
                approval_status: currentForm.professional.approval_status || 'self',
                business: prune(currentForm.professional.business),
              }
            : { is_professional: false },
          paypal_receiver_email: currentForm.paypal_receiver_email || null,
          style_profile: {
            ...user?.style_profile,
            aesthetics: currentForm.aesthetics
              ? currentForm.aesthetics.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
            color_palette: currentForm.color_palette
              ? currentForm.color_palette.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
            avoid: currentForm.avoid
              ? currentForm.avoid.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
          },
          cultural_context: {
            ...user?.cultural_context,
            dress_conservativeness: currentForm.dress_conservativeness,
          },
          scheduler_settings: {
            campaign_notification_prefs: currentForm.scheduler_settings?.campaign_notification_prefs,
          },
        };

        const updated = await api.patchMe(payload);
        updateUserLocal?.(updated);
        baselineRef.current = JSON.stringify(currentForm);
        setSaveStatus('saved');
        if (!silent) {
          toast.success(t('profile.savedProfile', { defaultValue: 'Profile updated.' }));
        }

        if (resetSavedTimeoutRef.current) {
          clearTimeout(resetSavedTimeoutRef.current);
        }
        resetSavedTimeoutRef.current = setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 3000);

        return updated;
      } catch (err) {
        setSaveStatus('error');
        toast.error(err?.response?.data?.detail || t('profile.saveFailed', { defaultValue: 'Save failed' }));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [user, updateUserLocal, baselineRef, t]
  );

  // Auto-save on change with debounce
  useEffect(() => {
    if (!isDirty) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        save({ silent: true });
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [form, isDirty, save]);

  // Save pending changes on unmount or before window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        save({ silent: true });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isDirtyRef.current) {
        save({ silent: true });
      }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (resetSavedTimeoutRef.current) clearTimeout(resetSavedTimeoutRef.current);
    };
  }, [save]);

  return { save, busy, saveStatus };
}
