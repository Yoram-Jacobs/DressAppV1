/**
 * apps/web/src/hooks/useUniversalSync.js
 *
 * Real-time Cross-Interface Synchronization Hook for Web & Desktop.
 * Listens to Server-Sent Events (SSE) and window visibility changes,
 * automatically updating all client stores whenever changes occur on any device.
 */
import { useEffect } from 'react';
import { syncManager, api } from '@/lib/api';
import { closetStore } from '@/lib/closetStore';
import { dailySuggestionsStore } from '@/lib/dailySuggestionsStore';
import { stylistStore } from '@/lib/stylistStore';
import { trendScoutStore } from '@/lib/trendScoutStore';
import { outfitStore } from '@/lib/outfitStore';

export function useUniversalSync(currentUser, onUserUpdated) {
  useEffect(() => {
    if (!currentUser) return;

    // Connect to SSE stream
    syncManager.connect();

    // Subscribe to sync events
    const unsubscribe = syncManager.subscribe(async (event) => {
      const { type, domain } = event || {};

      switch (type) {
        case 'profile_updated':
          try {
            const updated = await api.getMe();
            if (updated && onUserUpdated) {
              onUserUpdated(updated);
            }
          } catch {}
          break;

        case 'closet_updated':
          try {
            if (event?.payload?.action === 'delete' && event?.payload?.item_id) {
              closetStore.remove(event.payload.item_id);
            } else if (event?.payload?.action === 'update' && event?.payload?.item_id && event?.payload?.patch) {
              closetStore.upsert({ id: event.payload.item_id, ...event.payload.patch });
            }
            if (closetStore?.prewarm) {
              closetStore.prewarm({ force: true });
            }
          } catch {}
          break;

        case 'daily_suggestions_updated':
          try {
            if (dailySuggestionsStore?.prewarm) {
              dailySuggestionsStore.prewarm({ force: true });
            }
          } catch {}
          break;

        case 'stylist_updated':
          try {
            if (stylistStore?.prewarm) {
              stylistStore.prewarm({ force: true });
            }
          } catch {}
          break;

        case 'trend_scout_updated':
          try {
            if (trendScoutStore?.prewarm) {
              trendScoutStore.prewarm({ force: true });
            }
          } catch {}
          break;

        case 'lookbook_updated':
          try {
            if (outfitStore?.prewarm) {
              outfitStore.prewarm({ force: true });
            }
          } catch {}
          break;

        default:
          break;
      }
    });

    // Window focus and tab visibility listeners for state reconciliation
    const handleFocus = () => {
      syncManager.checkSyncStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncManager.checkSyncStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, onUserUpdated]);
}
