/**
 * apps/mobile/src/lib/iap.ts
 *
 * In-app purchase (IAP) abstraction layer — STUB VERSION.
 *
 * react-native-iap@12 has `play` / `amazon` product flavors baked into its
 * Gradle module. Without declaring a matching `store` flavor dimension in the
 * app's build.gradle, Gradle throws a variant-ambiguity error and the Android
 * build fails. Since IAP is not yet configured (requires App Store Connect
 * and Google Play Console product IDs), we replace the real implementation
 * with a stub that fails gracefully at runtime.
 *
 * ── When you're ready to enable IAP ─────────────────────────────────────────
 *  1. Add `"react-native-iap": "^12.16.1"` back to apps/mobile/package.json
 *  2. Add flavorDimensions / productFlavors to android/app/build.gradle
 *     (use an Expo config plugin — see docs/iap-setup.md)
 *  3. Replace this file with the real implementation below.
 *  4. Create products in App Store Connect and Google Play Console.
 *
 * ── Product IDs (must match exactly what's created in the stores) ──────────
 *  These IDs are agreed with the business/pricing team and registered in both
 *  stores. They mirror the web PayPal pricing tiers.
 */

// ── Product IDs ────────────────────────────────────────────────────────────

export const IAP_PRODUCTS = {
  CREDITS_SMALL:   'com.dressapp.mobile.credits.small',
  CREDITS_MEDIUM:  'com.dressapp.mobile.credits.medium',
  CREDITS_LARGE:   'com.dressapp.mobile.credits.large',
} as const;

export const IAP_SUBSCRIPTIONS = {
  BASIC_MONTHLY:   'com.dressapp.mobile.sub.basic.monthly',
  PRO_MONTHLY:     'com.dressapp.mobile.sub.pro.monthly',
  ELITE_MONTHLY:   'com.dressapp.mobile.sub.elite.monthly',
} as const;

export type IapProductId = typeof IAP_PRODUCTS[keyof typeof IAP_PRODUCTS];
export type IapSubId     = typeof IAP_SUBSCRIPTIONS[keyof typeof IAP_SUBSCRIPTIONS];

// Placeholder types so callers compile without react-native-iap installed
export type ProductPurchase    = { productId: string; transactionId?: string };
export type Purchase           = { productId: string; transactionId?: string };
export type SubscriptionPurchase = { productId: string; transactionId?: string };

const NOT_CONFIGURED = new Error(
  '[DressApp] IAP is not configured yet. ' +
  'See apps/mobile/src/lib/iap.ts for setup instructions.'
);

/** Initialize the IAP connection. */
export async function iapConnect(): Promise<boolean> {
  console.warn('[iap] IAP stub — not connected');
  return false;
}

/** Teardown the IAP connection. */
export async function iapDisconnect(): Promise<void> {
  /* no-op */
}

/** Fetch available one-time products from the store. */
export async function fetchProducts(): Promise<never> {
  throw NOT_CONFIGURED;
}

/** Fetch available subscriptions from the store. */
export async function fetchSubscriptions(): Promise<never> {
  throw NOT_CONFIGURED;
}

/** Initiate a one-time product purchase. */
export async function purchaseProduct(_productId: IapProductId): Promise<never> {
  throw NOT_CONFIGURED;
}

/** Initiate a subscription purchase. */
export async function purchaseSubscription(_subId: IapSubId): Promise<never> {
  throw NOT_CONFIGURED;
}

/**
 * Acknowledge a completed purchase.
 */
export async function acknowledgePurchase(
  _purchase: ProductPurchase | Purchase | SubscriptionPurchase,
): Promise<void> {
  throw NOT_CONFIGURED;
}

/** No-op listener stubs matching the react-native-iap API surface. */
export const purchaseErrorListener   = (_cb: unknown) => ({ remove: () => {} });
export const purchaseUpdatedListener = (_cb: unknown) => ({ remove: () => {} });
