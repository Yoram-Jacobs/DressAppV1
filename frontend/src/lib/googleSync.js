import { api } from './api';
import { prune } from './formUtils';

export async function fetchAndPrepareGoogleProfile(form) {
  const res = await api.googleSyncProfile();
  if (!res.success) {
    throw new Error('Google sync profile failed');
  }
  
  const newForm = {
    ...form,
    sex: res.sex || form.sex,
    phone: res.phone || form.phone,
    date_of_birth: res.date_of_birth || form.date_of_birth,
    address: {
      ...form.address,
      line1: res.address?.line1 || form.address.line1,
      line2: res.address?.line2 || form.address.line2,
      city: res.address?.city || form.address.city,
      region: res.address?.region || form.address.region,
      postal_code: res.address?.postal_code || form.address.postal_code,
      country: res.address?.country || form.address.country,
    }
  };

  const payload = {
    phone: newForm.phone || null,
    date_of_birth: newForm.date_of_birth || null,
    sex: newForm.sex || null,
    address: prune(newForm.address),
  };

  const updated = await api.patchMe(payload);
  return { newForm, updated };
}
