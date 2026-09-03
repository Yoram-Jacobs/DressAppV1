/**
 * apps/mobile/src/hooks/useUniversalSync.ts
 *
 * Real-time Cross-Interface Synchronization Hook for React Native / Expo.
 * Listens to AppState changes (background -> active) and Server-Sent Events (SSE),
 * ensuring changes made on web or desktop immediately reflect on the phone.
 */

import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { syncManager } from '@dressapp/api-client';
import { userStore } from '@mobile/lib/stores/userStore';
import { closetStore } from '@mobile/lib/stores/closetStore';
import { dailySuggestionsStore } from '@mobile/lib/stores/dailySuggestionsStore';
import { trendScoutStore } from '@mobile/lib/stores/trendScoutStore';
import { outfitStore } from '@mobile/lib/stores/outfitStore';

export function useUniversalSync(isLoggedIn: boolean = true) {
  useEffect(() => {
    if (!isLoggedIn) return;

    // Connect to SSE stream
    syncManager.connect();

    // Subscribe to incoming sync events
    const unsubscribe = syncManager.subscribe((event: any) => {
      const { type } = event || {};

      switch (type) {
        case 'profile_updated':
          userStore.prewarm({ force: true }).catch(() => {});
          break;

        case 'closet_updated':
          closetStore.prewarm({ force: true }).catch(() => {});
          break;

        case 'daily_suggestions_updated':
          dailySuggestionsStore.prewarm({ force: true }).catch(() => {});
          break;

        case 'trend_scout_updated':
          trendScoutStore.prewarm({ force: true }).catch(() => {});
          break;

        case 'lookbook_updated':
          outfitStore.prewarm({ force: true }).catch(() => {});
          break;

        default:
          break;
      }
    });

    // AppState listener: reconcile stores when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        syncManager.connect();
        syncManager.checkSyncStatus().catch(() => {});
      } else if (nextAppState === 'background') {
        syncManager.disconnect();
      }
    });

    return () => {
      unsubscribe();
      subscription.remove();
      syncManager.disconnect();
    };
  }, [isLoggedIn]);
}
