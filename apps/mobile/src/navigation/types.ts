/**
 * apps/mobile/src/navigation/types.ts
 *
 * React Navigation type definitions for all navigators and screens.
 * Used for typed useNavigation() and useRoute() hooks throughout the app.
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

// ── Auth Stack ─────────────────────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  AuthCallback: { code?: string; state?: string; error?: string };
};

// ── Closet Stack ──────────────────────────────────────────────────────────
export type ClosetStackParamList = {
  Closet: undefined;
  ItemDetail: { itemId: string };
  ClosetAdd?: { source?: 'camera' | 'manual' } | undefined;
  DppScanner: undefined;
  Avatar: undefined;
  SharedOutfit: { outfitId: string };
};

// ── Stylist Stack ─────────────────────────────────────────────────────────
export type StylistStackParamList = {
  Stylist: undefined;
  Outfits: undefined;
  Avatar: undefined;
  SharedOutfit: { outfitId: string };
  ItemDetail: { itemId: string };
};

// ── Market Stack ──────────────────────────────────────────────────────────
export type MarketStackParamList = {
  Marketplace: undefined;
  ListingDetail: { listingId: string };
  CreateListing: undefined;
  TransactionLanding: { transactionId: string };
  Transactions: undefined;
  AdsManager: undefined;
  MockAtzmaiPayment: { paymentId?: string; amount?: string; description?: string; method?: string };
};

// ── Me (Profile) Stack ────────────────────────────────────────────────────
export type MeStackParamList = {
  Profile: undefined;
  WardrobeStats: undefined;
  Stats: undefined;
  Outfits: undefined;
  Avatar: undefined;
  SharedOutfit: { outfitId: string };
  ItemDetail: { itemId: string };
  Stylist: undefined;
  Settings: undefined;
  DeleteAccount: undefined;
  Privacy: undefined;
  Terms: undefined;
  Pricing: undefined;
  Suitcase: undefined;
  TrendScout: undefined;
  ExpertsDirectory: undefined;
  Experts: undefined;
  Campaigns: undefined;
  CreateCampaign: undefined;
  CampaignDetail: { campaignId: string };
  EyesDownload: undefined;
  Admin: undefined;
  ExtensionConnect: undefined;
  AdsManager: undefined;
  MockAtzmaiPayment: { paymentId?: string; amount?: string; description?: string; method?: string };
};

// ── Main Tabs ─────────────────────────────────────────────────────────────
export type MainTabsParamList = {
  ClosetTab: NavigatorScreenParams<ClosetStackParamList>;
  StylistTab: NavigatorScreenParams<StylistStackParamList>;
  Capture: undefined;             // Floating FAB — no real tab screen
  MarketTab: NavigatorScreenParams<MarketStackParamList>;
  MeTab: NavigatorScreenParams<MeStackParamList>;
};

// ── Root Navigator ────────────────────────────────────────────────────────
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
};
