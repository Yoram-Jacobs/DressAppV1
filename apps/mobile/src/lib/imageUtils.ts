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
