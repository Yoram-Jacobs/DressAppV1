import { useSyncExternalStore, useEffect } from 'react';
import { suitcaseStore } from '@/lib/suitcaseStore';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';

export function useSuitcaseStore({ prewarm = false } = {}) {
  const snap = useSyncExternalStore(
    suitcaseStore.subscribe.bind(suitcaseStore),
    suitcaseStore.getSnapshot.bind(suitcaseStore),
    suitcaseStore.getSnapshot.bind(suitcaseStore),
  );
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!prewarm || !user) return;
    suitcaseStore.prewarm({ t }).catch(() => {});
  }, [prewarm, user, t]);

  return {
    activeSuitcase: snap.activeSuitcase,
    viewState: snap.viewState,
    packingData: snap.packingData,
    messages: snap.messages,
    archives: snap.archives,
    loading: snap.loading,
    archiveLoading: snap.archiveLoading,
    error: snap.error,
    lastFullSync: snap.lastFullSync,
    
    prewarm: (opts) => suitcaseStore.prewarm({ t, ...opts }),
    updateViewState: suitcaseStore.updateViewState.bind(suitcaseStore),
    updateActiveSuitcase: suitcaseStore.updateActiveSuitcase.bind(suitcaseStore),
    updatePackingData: suitcaseStore.updatePackingData.bind(suitcaseStore),
    updateMessages: suitcaseStore.updateMessages.bind(suitcaseStore),
    updateArchives: suitcaseStore.updateArchives.bind(suitcaseStore),
    setArchiveLoading: suitcaseStore.setArchiveLoading.bind(suitcaseStore),
    reset: () => suitcaseStore.reset(t)
  };
}
