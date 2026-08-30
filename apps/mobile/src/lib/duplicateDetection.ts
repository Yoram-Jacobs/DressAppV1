/**
 * apps/mobile/src/lib/duplicateDetection.ts
 *
 * Client-side duplicate detection for the mobile Add-Item upload flow.
 * 1:1 parity with apps/web/src/lib/duplicateDetection.js and backend image_hash.py.
 */

import * as Crypto from 'expo-crypto';

export const HAMMING_THRESHOLD = 10;
export const HAMMING_THRESHOLD_STRICT = 3;
export const COLOR_THRESHOLD = 220;

export const HAMMING_SENTINEL = 65;
export const COLOR_SENTINEL = 10_000;

export interface PhotoFingerprint {
  uri: string;
  base64?: string;
  sha256?: string | null;
  phash?: string | null;
  color_sig?: string | null;
  filename?: string | null;
  size_bytes?: number | null;
}

export interface DuplicateMatchResult {
  sha256?: string | null;
  phash?: string | null;
  filename?: string | null;
  size_bytes?: number | null;
  matchKey: string;
  previewUrl?: string;
  existing?: {
    id: string;
    title?: string;
    item_type?: string;
    sub_category?: string;
    color?: string;
    thumbnail_data_url?: string;
    is_duplicate?: boolean;
  };
}

/**
 * Compute SHA-256 hex digest for a string (typically clean base64 data).
 */
export async function computeSha256(data: string): Promise<string> {
  if (!data) return '';
  try {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
  } catch (e) {
    console.warn('computeSha256 failed:', e);
    return '';
  }
}

/**
 * Hamming distance between two 16-char hex aHash digests.
 */
export function hammingDistance(a?: string | null, b?: string | null): number {
  if (!a || !b || a.length !== b.length) return HAMMING_SENTINEL;
  try {
    let dist = 0;
    for (let i = 0; i < a.length; i += 2) {
      const ai = parseInt(a.slice(i, i + 2), 16);
      const bi = parseInt(b.slice(i, i + 2), 16);
      if (Number.isNaN(ai) || Number.isNaN(bi)) return HAMMING_SENTINEL;
      let x = ai ^ bi;
      while (x) {
        dist += 1;
        x &= x - 1;
      }
    }
    return dist;
  } catch {
    return HAMMING_SENTINEL;
  }
}

/**
 * Manhattan distance between two 24-char hex colour signatures.
 */
export function colorDistance(a?: string | null, b?: string | null): number {
  if (!a || !b || a.length !== b.length) return COLOR_SENTINEL;
  try {
    let dist = 0;
    for (let i = 0; i < a.length; i += 2) {
      const ai = parseInt(a.slice(i, i + 2), 16);
      const bi = parseInt(b.slice(i, i + 2), 16);
      if (Number.isNaN(ai) || Number.isNaN(bi)) return COLOR_SENTINEL;
      dist += Math.abs(ai - bi);
    }
    return dist;
  } catch {
    return COLOR_SENTINEL;
  }
}

/**
 * Decision tree for "are these two images duplicates?".
 */
export function isDuplicateMatch({
  shaA,
  shaB,
  phashA,
  phashB,
  colorA,
  colorB,
  hammingThreshold = HAMMING_THRESHOLD,
}: {
  shaA?: string | null;
  shaB?: string | null;
  phashA?: string | null;
  phashB?: string | null;
  colorA?: string | null;
  colorB?: string | null;
  hammingThreshold?: number;
} = {}): boolean {
  // Pass 1 — exact byte match.
  if (shaA && shaB && shaA === shaB) return true;
  // Pass 2 — shape similarity is the prerequisite.
  if (!phashA || !phashB) return false;
  return hammingDistance(phashA, phashB) <= hammingThreshold;
}

/**
 * Find pre-flight duplicate matches for an incoming upload batch by
 * scanning the locally-cached closet snapshot and intra-batch items.
 */
export function findDuplicatesInCloset(
  fingerprints: PhotoFingerprint[],
  closetItems: any[]
): { matches: DuplicateMatchResult[] } {
  if (!Array.isArray(fingerprints) || fingerprints.length === 0) {
    return { matches: [] };
  }

  const matches: DuplicateMatchResult[] = [];
  const seen = new Set<string>();

  // 1. First Pass: check for duplicates WITHIN the upload batch itself.
  const batchSurvivors: PhotoFingerprint[] = [];
  for (let i = 0; i < fingerprints.length; i++) {
    const p = fingerprints[i];
    if (!p) continue;

    let batchDupOf: PhotoFingerprint | null = null;
    for (const prevFp of batchSurvivors) {
      if (
        isDuplicateMatch({
          shaA: p.sha256,
          shaB: prevFp.sha256,
          phashA: p.phash,
          phashB: prevFp.phash,
          colorA: p.color_sig,
          colorB: prevFp.color_sig,
        })
      ) {
        batchDupOf = prevFp;
        break;
      }
    }

    if (batchDupOf) {
      const matchKey = p.sha256 || p.phash || `${p.filename || 'batch'}_${i}`;
      if (!seen.has(matchKey)) {
        seen.add(matchKey);
        matches.push({
          sha256: p.sha256 || null,
          phash: p.phash || null,
          filename: p.filename || null,
          size_bytes: typeof p.size_bytes === 'number' ? p.size_bytes : null,
          matchKey,
          previewUrl: p.uri || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : undefined),
          existing: {
            id: `batch-${batchDupOf.filename || 'dup'}`,
            title: `Duplicate of ${batchDupOf.filename || 'another selected photo'}`,
            item_type: 'Batch Photo',
            thumbnail_data_url: batchDupOf.uri || (batchDupOf.base64 ? `data:image/jpeg;base64,${batchDupOf.base64}` : undefined),
            is_duplicate: false,
          },
        });
      }
    } else {
      batchSurvivors.push(p);
    }
  }

  // 2. Second Pass: check the survivors against the existing closet items.
  const items = Array.isArray(closetItems) ? closetItems : [];
  const candidates = items.filter(
    (it) => it && (it.source_sha256 || it.source_phash)
  );

  if (candidates.length > 0) {
    const bySha = new Map<string, any>();
    for (const it of candidates) {
      if (it.source_sha256) bySha.set(it.source_sha256, it);
    }

    for (const p of batchSurvivors) {
      let existing: any = null;

      // Pass 1 — exact byte match.
      if (p.sha256 && bySha.has(p.sha256)) {
        existing = bySha.get(p.sha256);
      }

      // Pass 2 — shape similarity.
      if (!existing && p.phash) {
        let bestDist = HAMMING_THRESHOLD + 1;
        for (const it of candidates) {
          if (
            !isDuplicateMatch({
              shaA: p.sha256,
              shaB: it.source_sha256,
              phashA: p.phash,
              phashB: it.source_phash,
              colorA: p.color_sig,
              colorB: it.source_color_sig,
            })
          ) {
            continue;
          }
          const d = hammingDistance(p.phash, it.source_phash);
          if (d < bestDist) {
            bestDist = d;
            existing = it;
          }
        }
      }

      if (!existing) continue;

      const matchKey = p.sha256 || p.phash || `${p.filename || 'upload'}_${existing.id}`;
      if (seen.has(matchKey)) continue;
      seen.add(matchKey);

      matches.push({
        sha256: p.sha256 || null,
        phash: p.phash || null,
        filename: p.filename || null,
        size_bytes: typeof p.size_bytes === 'number' ? p.size_bytes : null,
        matchKey,
        previewUrl: p.uri || (p.base64 ? `data:image/jpeg;base64,${p.base64}` : undefined),
        existing: {
          id: existing.id,
          title: existing.title || existing.name || 'Existing item',
          item_type: existing.item_type || null,
          sub_category: existing.sub_category || null,
          color: existing.color || null,
          thumbnail_data_url:
            existing.thumbnail_data_url ||
            existing.clean_image_url ||
            existing.segmented_image_url ||
            existing.original_image_url ||
            null,
          is_duplicate: !!existing.is_duplicate,
        },
      });
    }
  }

  return { matches };
}
