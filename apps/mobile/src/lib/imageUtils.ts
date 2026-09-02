/**
 * apps/mobile/src/lib/imageUtils.ts
 *
 * Single seam for all garment image URL logic in the mobile app.
 *
 * Exports:
 *   resolveImageUrl        — generic URL absolutifier for non-garment call sites (avatars, etc.)
 *   resolveDisplayUrl      — sentinel guard + format normaliser (lifted from ItemDetailScreen)
 *   resolveGarmentImageUrl — priority-ordered URL resolver for any Garment / ClosetItem object
 */

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://dressapp.co';

// ─── Generic URL absolutifier (unchanged — used by Avatar, Profile, etc.) ────

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

// ─── Sentinel guard + format normaliser ──────────────────────────────────────
//
// Filters out Python `None`, JSON `null`, stringified objects and bare raw
// base64 blobs that are not yet prefixed with a data-URI header. Returns a
// fully qualified URL or null.

const SENTINEL_STRINGS = new Set(['None', 'null', 'undefined', '[object Object]']);

export function resolveDisplayUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t || SENTINEL_STRINGS.has(t)) return null;

  if (
    t.startsWith('data:') ||
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('file://')
  ) {
    return t;
  }
  if (t.startsWith('/')) return `${BACKEND_URL}${t}`;

  // Raw base64 magic-byte detection
  if (t.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${t}`;
  if (t.startsWith('/9j/'))        return `data:image/jpeg;base64,${t}`;
  if (t.startsWith('UklGR'))       return `data:image/webp;base64,${t}`;

  return null;
}

// ─── Garment image URL resolver ───────────────────────────────────────────────
//
// Accepts any object that carries one or more of the standard Garment image
// fields and returns the best available URL according to the `prefer` mode:
//
//   'cutout'    (default) — prioritise transparent Cutout / Clean Image; fall
//               back through reconstructed → variants → original → thumbnail.
//               Use in: ItemDetailScreen (cutout view), scheduler outfit items.
//
//   'original'  — prioritise the raw original or variant; fall back through
//               cutout → thumbnail. Use in: ItemDetailScreen (raw view).
//
//   'thumbnail' — prioritise thumbnail_data_url first (smallest, fastest),
//               then cutout chain. Use in: ClosetScreen grid.

export interface GarmentImageSource {
  clean_image_url?: string | null;
  segmented_image_url?: string | null;
  cutout_url?: string | null;
  reconstructed_image_url?: string | null;
  image_variants?: {
    webp?: { large?: string; medium?: string };
    avif?: { medium?: string };
    original?: string;
  } | null;
  original_image_url?: string | null;
  image_url?: string | null;
  thumbnail_data_url?: string | null;
  placeholder_data_url?: string | null;
}

type GarmentImagePrefer = 'cutout' | 'original' | 'thumbnail';

function _r(url: string | null | undefined): string | null {
  return resolveDisplayUrl(url);
}

function _variants(src: GarmentImageSource): string | null {
  return (
    _r(src.image_variants?.webp?.large)  ||
    _r(src.image_variants?.webp?.medium) ||
    _r(src.image_variants?.avif?.medium) ||
    _r(src.image_variants?.original)     ||
    null
  );
}

export function resolveGarmentImageUrl(
  src: GarmentImageSource | null | undefined,
  opts?: { prefer?: GarmentImagePrefer },
): string | null {
  if (!src) return null;
  const prefer: GarmentImagePrefer = opts?.prefer ?? 'cutout';

  const cutout  = _r(src.clean_image_url) || _r(src.segmented_image_url) || _r(src.cutout_url) || null;
  const recon   = _r(src.reconstructed_image_url);
  const variant = _variants(src);
  const orig    = _r(src.original_image_url) || _r(src.image_url);
  const thumb   = _r(src.thumbnail_data_url) || _r(src.placeholder_data_url);

  switch (prefer) {
    case 'thumbnail':
      return thumb || cutout || recon || variant || orig || null;
    case 'original':
      return orig || variant || cutout || recon || thumb || null;
    case 'cutout':
    default:
      return cutout || recon || variant || orig || thumb || null;
  }
}

