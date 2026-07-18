/**
 * campaignStore — cached store for the public campaign feed.
 *
 * Follows the same createCachedStore pattern used by expertsStore.js
 * and marketplaceStore.js in this codebase.
 */
import { createCachedStore } from '@/lib/createCachedStore';
import { api } from '@/lib/api';

export const campaignStore = createCachedStore({
  name: 'campaigns',
  fetcher: async (params) => api.getCampaignFeed(params),
  // Expire cache entries after 3 minutes
  ttlMs: 3 * 60 * 1000,
});
