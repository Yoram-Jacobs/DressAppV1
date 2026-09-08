/**
 * apps/mobile/src/lib/country.ts
 *
 * Normalizes user country representations to standard 2-letter uppercase ISO country codes.
 * Prevents 422 Unprocessable Entity query parameter issues and ensures server cache hits.
 */

const COUNTRY_MAP: Record<string, string> = {
  ISRAEL: 'IL',
  'ישראל': 'IL',
  USA: 'US',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  UK: 'GB',
  'UNITED KINGDOM': 'GB',
  GREAT_BRITAIN: 'GB',
  FRANCE: 'FR',
  GERMANY: 'DE',
  ITALY: 'IT',
  SPAIN: 'ES',
  CANADA: 'CA',
  AUSTRALIA: 'AU',
  JAPAN: 'JP',
};

export function toCountryCode(val?: string | null): string {
  if (!val) return 'IL';
  const clean = String(val).trim().toUpperCase().replace(/\+$/, '');
  if (!clean) return 'IL';
  if (COUNTRY_MAP[clean]) return COUNTRY_MAP[clean];
  if (clean.length === 2) return clean;
  if (clean.includes('ISRAEL') || clean.includes('ישראל')) return 'IL';
  if (clean.includes('UNITED STATES') || clean.includes('USA')) return 'US';
  if (clean.includes('UNITED KINGDOM') || clean.includes('ENGLAND')) return 'GB';
  return clean.slice(0, 2);
}
