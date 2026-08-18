/**
 * Centralised "best image" resolver for a ClosetItem document.
 *
 * Checks all possible image fields in priority order:
 *   1. thumbnail_data_url
 *   2. reconstructed_image_url
 *   3. clean_image_url
 *   4. cutout_url
 *   5. segmented_image_url
 *   6. image_variants
 *   7. original_image_url
 *   8. image_url
 *   9. photo_url
 */
export function bestImageUrl(item, opts = {}) {
  if (!item) return null;
  if (!opts.skipReconstruction && item.reconstructed_image_url) {
    return item.reconstructed_image_url;
  }
  if (item.thumbnail_data_url) return item.thumbnail_data_url;

  if (item.clean_image_url) return item.clean_image_url;
  if (item.cutout_url) return item.cutout_url;
  if (item.segmented_image_url) return item.segmented_image_url;

  // Dynamic Transcoding Variants (AVIF/WebP)
  if (item.image_variants) {
    if (item.image_variants.avif?.medium) return item.image_variants.avif.medium;
    if (item.image_variants.webp?.medium) return item.image_variants.webp.medium;
    if (item.image_variants.original) return item.image_variants.original;
  }

  if (item.original_image_url) return item.original_image_url;
  if (item.image_url) return item.image_url;
  if (item.photo_url) return item.photo_url;
  return null;
}

/**
 * Returns true when the backend is still running its rembg matte.
 */
export function isCleanImagePending(item) {
  return !!(item && item.clean_image_status === 'pending');
}
