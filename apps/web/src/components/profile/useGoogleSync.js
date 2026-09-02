import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fetchAndPrepareGoogleProfile } from '@/lib/googleSync';

export function useGoogleSync(form, setForm, t) {
  const [syncingGoogle, setSyncingGoogle] = useState(false);

  const syncGoogleProfile = async () => {
    setSyncingGoogle(true);
    try {
      const { newForm } = await fetchAndPrepareGoogleProfile(form);
      setForm(newForm);
      return { success: true, newForm };
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail === 'missing_people_scopes') {
        toast.info(
          t('profile.googleReConsentNeeded', {
            defaultValue: 'Google needs your permission to access profile details. You will be redirected to Google to grant access.',
          }),
          { duration: 6000 },
        );
        try {
          const { authorization_url } = await api.googleReConsent(false);
          if (authorization_url) {
            window.location.href = authorization_url;
          }
        } catch {
          toast.error(t('profile.googleSyncFailed', { defaultValue: 'Failed to sync with Google.' }));
        }
      } else {
        toast.error(detail || t('profile.googleSyncFailed', { defaultValue: 'Failed to sync with Google.' }));
      }
    } finally {
      setSyncingGoogle(false);
    }
    return { success: false };
  };

  return { syncingGoogle, syncGoogleProfile };
}
