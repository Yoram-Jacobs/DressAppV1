/**
 * Centralised "best image" resolver for a ClosetItem document.
 *
 * Checks all possible image fields in priority order (background-free first):
 *   1. reconstruct_image_url / reconstructed_image_url ← AI-reconstructed background-free studio image
 *   2. clean_image_url        ← background-removed cutout (transparent PNG)
 *   3. cutout_url             ← segmented cutout
 *   4. segmented_image_url    ← alternative segmented form
 *   5. image_variants         ← AVIF/WebP transcoded variants
 *   6. original_image_url     ← original photo (may have background)
 *   7. image_url              ← generic image URL
 *   8. thumbnail_data_url     ← card thumbnail (has white card background — last resort)
 *   9. photo_url              ← legacy field
 *
 * NOTE: thumbnail_data_url is intentionally last because it contains the item
 * rendered on a white card background, which causes a white rectangle to appear
 * when overlaid on the avatar. All background-free sources are preferred first.
 */
export function getStoredViewPreference() {
  try {
    return localStorage.getItem('dressapp_preferred_image_view') || 'repaired';
  } catch (e) {
    return 'repaired';
  }
}

export function setStoredViewPreference(view) {
  try {
    localStorage.setItem('dressapp_preferred_image_view', view);
  } catch (e) {}
}

export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  ) {
    return url;
  }
  // In local development, resolve relative /static/ and /uploads/ paths to production media server
  if (url.startsWith('/static/') || url.startsWith('/uploads/')) {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(
        window.location.hostname
      );
      if (isLocal) {
        return `https://dressapp.co${url}`;
      }
    }
  }
  return url;
}

export function bestImageUrl(item, opts = {}) {
  if (!item) return null;

  // Determine effective view mode:
  // Item preference > explicit opts.viewMode > global stored preference > default 'repaired'
  const itemPref = item.preferred_image_view || item.preferred_view;
  const itemMode = itemPref
    ? (itemPref === 'clean' || itemPref === 'original' ? 'original' : 'repaired')
    : undefined;

  const viewMode = opts.viewMode || (opts.skipReconstruction ? 'original' : (itemMode || (opts.useStoredPreference ? getStoredViewPreference() : 'repaired')));

  let resolved = null;

  // 1. AI-reconstructed image (background-free studio quality)
  if (viewMode !== 'original' && !opts.skipReconstruction) {
    if (item.reconstruct_image_url) resolved = item.reconstruct_image_url;
    else if (item.reconstructed_image_url) resolved = item.reconstructed_image_url;
  }

  // 2. Background-free clean cutout (Original crop)
  if (!resolved && item.clean_image_url) resolved = item.clean_image_url;

  // 3. Segmented / cutout forms
  if (!resolved && item.cutout_url) resolved = item.cutout_url;
  if (!resolved && item.segmented_image_url) resolved = item.segmented_image_url;

  // 4. Listing images array
  if (!resolved && Array.isArray(item.images) && item.images.length > 0 && typeof item.images[0] === 'string' && item.images[0]) {
    resolved = item.images[0];
  }

  // 5. Dynamic Transcoding Variants (AVIF/WebP)
  if (!resolved && item.image_variants) {
    if (item.image_variants.avif?.medium) resolved = item.image_variants.avif.medium;
    else if (item.image_variants.webp?.medium) resolved = item.image_variants.webp.medium;
    else if (item.image_variants.original) resolved = item.image_variants.original;
  }

  // 6. Raw originals / generic image URL
  if (!resolved && item.original_image_url) resolved = item.original_image_url;
  if (!resolved && item.image_url) resolved = item.image_url;

  // 7. Thumbnail (has white card background)
  if (!resolved && item.thumbnail_data_url) resolved = item.thumbnail_data_url;

  if (!resolved && item.photo_url) resolved = item.photo_url;

  return resolveMediaUrl(resolved);
}

/**
 * Returns true when the backend is still running its rembg matte.
 */
export function isCleanImagePending(item) {
  return !!(item && item.clean_image_status === 'pending');
}

