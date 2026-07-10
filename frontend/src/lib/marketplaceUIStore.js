import { createSimpleStore } from './createSimpleStore';

export const marketplaceUIStore = createSimpleStore({
  transactions: [],
  transactionsLoading: true,
});
