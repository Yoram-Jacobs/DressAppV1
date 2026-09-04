/**
 * useMarketplaceProgress — React adapter over the singleton
 * ``marketplaceProgress`` pub/sub in ``marketplaceStore.js``.
 *
 * Returns a stable snapshot ``{browse, backfill}`` plus the two
 * stream-drive methods so a component can do everything from a
 * single import:
 *
 *     const { backfill, streamBackfill } = useMarketplaceProgress();
 *     <Button onClick={streamBackfill}>Sync</Button>
 *     <StreamingProgressChip progress={backfill} ... />
 */
import { useSyncExternalStore } from 'react';
import { marketplaceProgress } from '@/lib/marketplaceStore';

const _subscribe = marketplaceProgress.subscribe.bind(marketplaceProgress);
const _getSnapshot = marketplaceProgress.getSnapshot.bind(marketplaceProgress);

export function useMarketplaceProgress() {
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
  return {
    browse: snap.browse,
    backfill: snap.backfill,
    streamBrowse: marketplaceProgress.streamBrowse.bind(marketplaceProgress),
    streamBackfill: marketplaceProgress.streamBackfill.bind(marketplaceProgress),
    reset: marketplaceProgress.reset.bind(marketplaceProgress),
  };
}
