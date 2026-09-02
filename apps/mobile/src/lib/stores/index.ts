/**
 * apps/mobile/src/lib/stores/index.ts
 */

export * from './userStore';
export * from './closetStore';
export * from './outfitStore';
export * from './marketplaceStore';
export * from './expertsStore';
export * from './trendScoutStore';
export * from './dailySuggestionsStore';
export * from './adminStore';
export * from './workStore';
export * from './suitcaseStore';

import { userStore } from './userStore';
import { closetStore } from './closetStore';
import { outfitStore } from './outfitStore';
import { marketplaceStore } from './marketplaceStore';
import { expertsStore } from './expertsStore';
import { trendScoutStore } from './trendScoutStore';
import { suitcaseStore } from './suitcaseStore';
import { dailySuggestionsStore } from './dailySuggestionsStore';

/**
 * Eagerly prewarms all database loading stores when the app loads or user authenticates.
 * Runs in parallel so every screen is instantly populated on first visit.
 */
export async function prewarmAllStores(userId?: string): Promise<void> {
  try {
    await Promise.allSettled([
      userStore.prewarm(),
      closetStore.prewarm(),
      outfitStore.prewarm(),
      marketplaceStore.prewarm(),
      marketplaceStore.fetchMyListings(),
      expertsStore.prewarm(),
      suitcaseStore.prewarm(),
      trendScoutStore.prewarm(),
      dailySuggestionsStore.prewarm(),
    ]);
  } catch (err) {
    console.info('Store prewarming completed with non-fatal notice:', err);
  }
}

/**
 * Clears all cached store data on logout.
 */
export function resetAllStores(): void {
  try {
    userStore.reset();
    closetStore.reset();
    outfitStore.reset();
    marketplaceStore.reset();
    expertsStore.reset();
    trendScoutStore.reset();
    suitcaseStore.reset();
    dailySuggestionsStore.reset();
  } catch (err) {
    console.info('Reset stores error:', err);
  }
}
