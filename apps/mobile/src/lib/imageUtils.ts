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

  // Determine effective view mode:
  // Item preference > explicit opts.viewMode > global stored preference > default 'repaired'
  const itemPref = item.preferred_image_view || item.preferred_view;
  const itemMode: 'repaired' | 'original' | undefined = itemPref
    ? (itemPref === 'clean' || itemPref === 'original' ? 'original' : 'repaired')
    : undefined;

  const effectiveMode = opts.viewMode || itemMode || (opts.useStoredPreference !== false ? getMobileViewPreference() : 'repaired');

  let raw: string | undefined = undefined;

  if (effectiveMode === 'original') {
    // Show clean_image_url on 'Original crop'
    raw =
      item.clean_image_url ||
      item.cutout_url ||
      item.segmented_image_url ||
      (Array.isArray(item.images) && item.images[0]) ||
      item.original_image_url ||
      item.image_url ||
      item.thumbnail_data_url;
  } else {
    // Default AI-repaired view: reconstructed_image_url -> clean_image_url
    raw =
      item.reconstructed_image_url ||
      item.reconstruct_image_url ||
      item.clean_image_url ||
      item.cutout_url ||
      item.segmented_image_url ||
      (Array.isArray(item.images) && item.images[0]) ||
      item.original_image_url ||
      item.image_url ||
      item.thumbnail_data_url;
  }

  // Safety fallback if selected target is missing
  if (!raw) {
    raw =
      item.reconstructed_image_url ||
      item.reconstruct_image_url ||
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
