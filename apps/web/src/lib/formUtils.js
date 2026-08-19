export function prune(obj) {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== '' && v !== null && v !== undefined,
    ),
  );
}

export function setField(k, v) {
  return (f) => ({ ...f, [k]: v });
}

export function setNested(parent, k, v) {
  return (f) => ({ ...f, [parent]: { ...f[parent], [k]: v } });
}

export function setCampaignPref(k, v) {
  return (f) => ({
    ...f,
    scheduler_settings: {
      ...f.scheduler_settings,
      campaign_notification_prefs: {
        ...f.scheduler_settings.campaign_notification_prefs,
        [k]: v,
      },
    },
  });
}
