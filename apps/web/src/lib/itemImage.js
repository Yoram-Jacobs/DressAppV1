/**
 * Centralised "best image" resolver for a ClosetItem document.
 *
 * Checks all possible image fields in priority order (background-free first):
 *   1. clean_image_url        ← background-removed cutout (transparent PNG)
 *   2. reconstructed_image_url ← AI-reconstructed background-free image
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
export function bestImageUrl(item, opts = {}) {
  if (!item) return null;

  // 1. Background-free clean cutout (highest priority for avatar overlay)
  if (item.clean_image_url) return item.clean_image_url;

  // 2. AI-reconstructed image (background removed)
  if (!opts.skipReconstruction && item.reconstructed_image_url) {
    return item.reconstructed_image_url;
  }

  // 3. Segmented / cutout forms
  if (item.cutout_url) return item.cutout_url;
  if (item.segmented_image_url) return item.segmented_image_url;

  // 4. Dynamic Transcoding Variants (AVIF/WebP)
  if (item.image_variants) {
    if (item.image_variants.avif?.medium) return item.image_variants.avif.medium;
    if (item.image_variants.webp?.medium) return item.image_variants.webp.medium;
    if (item.image_variants.original) return item.image_variants.original;
  }

  // 5. Raw originals
  if (item.original_image_url) return item.original_image_url;
  if (item.image_url) return item.image_url;

  // 6. Thumbnail (last resort — has white card background)
  if (item.thumbnail_data_url) return item.thumbnail_data_url;

  if (item.photo_url) return item.photo_url;
  return null;
}

/**
 * Returns true when the backend is still running its rembg matte.
 */
export function isCleanImagePending(item) {
  return !!(item && item.clean_image_status === 'pending');
}
