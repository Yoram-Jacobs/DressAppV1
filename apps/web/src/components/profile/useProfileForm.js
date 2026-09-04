import { useState, useMemo, useRef } from 'react';

export function useProfileForm(user) {
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
      skin_tone: user?.skin_tone || '#9CA3AF',
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

  const baselineRef = useRef(JSON.stringify(initial));
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

  return {
    form,
    setForm,
    busy,
    setBusy,
    isFreshStart,
    setIsFreshStart,
    predicting,
    setPredicting,
    hasPredicted,
    setHasPredicted,
    isDirty,
    isFreshStartInitial,
    initial,
    setField,
    setNested,
    setCampaignPref,
    baselineRef,
  };
}
