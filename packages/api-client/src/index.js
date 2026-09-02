/**
 * packages/api-client/src/index.js
 *
 * Public API for @dressapp/api-client.
 *
 * USAGE:
 *   import { createApiClient, buildApi } from '@dressapp/api-client';
 *
 *   const { client, API_BASE, tokenStore, userStore } = createApiClient({ ...adapters });
 *   export const api = buildApi(client);
 */

// ============================================================
// Client factory (platform-adaptive)
// ============================================================
export { createApiClient } from './client.js';

// ============================================================
// Domain adapters builder
// ============================================================
import { auth } from './auth.js';
import { users } from './users.js';
import { closet } from './closet.js';
import { listings } from './listings.js';
import { transactions } from './transactions.js';
import { stylist } from './stylist.js';
import { outfits } from './outfits.js';
import { suitcase } from './suitcase.js';
import { admin } from './admin.js';
import { trends } from './trends.js';
import { professionals } from './professionals.js';
import { promotions } from './promotions.js';
import { pricing } from './pricing.js';
import { share } from './share.js';
import { calendar, misc } from './misc.js';
import { campaignApi } from './campaigns.js';
import { avatar } from './avatar.js';

/**
 * Build the merged `api` object from domain modules.
 * Each domain module is a plain object of functions that already
 * close over the `client` import from ./client.js.
 *
 * NOTE: The domain modules (auth.js, closet.js, etc.) import `client`
 * from './client.js'. Because createApiClient() mutates the module-level
 * `client` export via axios.create(), the domain modules see the
 * configured instance after createApiClient() has been called once.
 *
 * This function simply assembles the spread for backward compatibility.
 */
export function buildApi() {
  return {
    ...auth,
    ...users,
    ...closet,
    ...listings,
    ...transactions,
    ...stylist,
    ...outfits,
    ...suitcase,
    ...admin,
    ...trends,
    ...professionals,
    ...promotions,
    ...pricing,
    ...share,
    ...avatar,
    ...calendar,
    ...misc,
    ...campaignApi,
  };
}

// ============================================================
// Individual adapters (for focused imports in mobile screens)
// ============================================================
export { auth, users, closet, listings, transactions, stylist, outfits };
export { suitcase, admin, trends, professionals, promotions, pricing, share, avatar };
export { calendar, misc, campaignApi };

// ============================================================
// Streaming utilities
// ============================================================
export { streamNdjson } from './streamNdjson.js';
