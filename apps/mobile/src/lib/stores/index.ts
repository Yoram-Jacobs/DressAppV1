/**
 * apps/mobile/src/lib/stores/index.ts
 */

export * from './userStore';
export * from './outfitStore';
export * from './marketplaceStore';
export * from './expertsStore';
export * from './trendScoutStore';
export * from './dailySuggestionsStore';
export * from './adminStore';
export * from './workStore';
export * from './suitcaseStore';
export { closetRepo, useCloset } from '../repositories/closetRepository';
export type { ClosetItem, WardrobeSummary } from '../repositories/closetRepository';

import { userStore } from './userStore';
import { closetRepo } from '../repositories/closetRepository';

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
      closetRepo.refresh(),
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
    closetRepo.reset();
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

