// ============================================================
// Shared infrastructure
// ============================================================
import { client, API_BASE, tokenStore, userStore } from './client.js';
import { streamNdjson } from './streaming.js';

// ============================================================
// Domain adapters
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

// ============================================================
// Backward-compatible merged `api` object
// (preserves `import { api } from '@/lib/api'` across 46+ files)
// ============================================================
export const api = {
  // auth
  ...auth,
  // users
  ...users,
  // closet + streaming analyze
  ...closet,
  // listings
  ...listings,
  // transactions + marketplace buy
  ...transactions,
  // stylist + power-up
  ...stylist,
  // outfits + scheduler
  ...outfits,
  // suitcase
  ...suitcase,
  // admin
  ...admin,
  // trends
  ...trends,
  // professionals
  ...professionals,
  // promotions / ad campaigns
  ...promotions,
  // pricing / credits / paypal
  ...pricing,
  // share (read-only outfit snapshots)
  ...share,
  // avatar
  ...avatar,
  // calendar + misc
  ...calendar,
  ...misc,
};

// ============================================================
// Individual adapters (for new, focused imports)
// ============================================================
export { auth, users, closet, listings, transactions, stylist, outfits };
export { suitcase, admin, trends, professionals, promotions, pricing, share, avatar };
export { calendar, misc };
export { campaignApi };

// ============================================================
// Shared infrastructure exports (backward compatibility)
// ============================================================
export { client, API_BASE, tokenStore, userStore, streamNdjson };

// ============================================================
// Default export: the raw axios client
// ============================================================
export default client;
