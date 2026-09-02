/**
 * apps/mobile/src/lib/imageUtils.ts
 *
 * Image URL normalization and resolution utility for React Native.
 * Ensures relative paths (/static/uploads/...) are converted to full absolute URLs.
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://dressapp.co';

export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (
    url.startsWith('data:') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://')
  ) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_URL}${cleanPath}`;
}

let mobilePreferredView: 'repaired' | 'original' = 'repaired';

export function getMobileViewPreference(): 'repaired' | 'original' {
  return mobilePreferredView;
}

export function setMobileViewPreference(view: 'repaired' | 'original') {
  mobilePreferredView = view;
}

export function getItemImageUrl(
  item: any,
  opts: { viewMode?: 'repaired' | 'original'; useStoredPreference?: boolean } = {}
): string | undefined {
  if (!item) return undefined;
  const viewMode = opts.viewMode || (opts.useStoredPreference ? getMobileViewPreference() : 'repaired');

  let raw: string | undefined = undefined;
  if (viewMode === 'repaired') {
    raw = item.reconstructed_image_url || item.reconstruct_image_url;
  }
  if (!raw) {
    raw =
      item.clean_image_url ||
      item.cutout_url ||
      item.segmented_image_url ||
      (Array.isArray(item.images) && item.images[0]) ||
      item.original_image_url ||
      item.image_url ||
      item.thumbnail_data_url ||
      item.photo_url;
  }
  return resolveImageUrl(raw);
}
