import { useSyncExternalStore, useEffect, useCallback } from 'react';
import { suitcaseStore } from '@/lib/suitcaseStore';
import { useAuth } from '@/lib/auth';
import { useTranslation } from 'react-i18next';

const _subscribe = suitcaseStore.subscribe.bind(suitcaseStore);
const _getSnapshot = suitcaseStore.getSnapshot.bind(suitcaseStore);

export const updateViewStateSuitcase = suitcaseStore.updateViewState.bind(suitcaseStore);
export const updateActiveSuitcaseSuitcase = suitcaseStore.updateActiveSuitcase.bind(suitcaseStore);
export const updatePackingDataSuitcase = suitcaseStore.updatePackingData.bind(suitcaseStore);
export const updateMessagesSuitcase = suitcaseStore.updateMessages.bind(suitcaseStore);
export const updateArchivesSuitcase = suitcaseStore.updateArchives.bind(suitcaseStore);
export const setArchiveLoadingSuitcase = suitcaseStore.setArchiveLoading.bind(suitcaseStore);

export function useSuitcaseStore({ prewarm = false } = {}) {
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (!prewarm || !user) return;
    suitcaseStore.prewarm({ t }).catch(() => {});
  }, [prewarm, user, t]);

  const prewarmFn = useCallback((opts) => suitcaseStore.prewarm({ t, ...opts }), [t]);
  const resetFn = useCallback(() => suitcaseStore.reset(t), [t]);

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
    
    prewarm: prewarmFn,
    updateViewState: updateViewStateSuitcase,
    updateActiveSuitcase: updateActiveSuitcaseSuitcase,
    updatePackingData: updatePackingDataSuitcase,
    updateMessages: updateMessagesSuitcase,
    updateArchives: updateArchivesSuitcase,
    setArchiveLoading: setArchiveLoadingSuitcase,
    reset: resetFn,
  };
}
