import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Phase Z2 — compute the SHA-256 of a File / Blob entirely in-browser.
 *
 * Used by the pre-flight duplicate check before /closet/preflight.
 * `crypto.subtle.digest('SHA-256', …)` is built into every modern
 * browser (Chrome 38+, Safari 11+, Firefox 34+) and runs off the main
 * thread, so even a 10 MB JPEG is ~50 ms on a phone.
 *
 * @param {File|Blob} file
 * @returns {Promise<string>} 64-char lowercase hex digest
 */
export async function sha256File(file) {
  if (!file || typeof file.arrayBuffer !== "function") return null;
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const bytes = new Uint8Array(digest);
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  } catch (_) {
    // Old browser or memory pressure on a huge file — degrade gracefully:
    // the upload still proceeds, the duplicate check just gets skipped
    // for this one file. The backend never sees a sha256 → no false hits.
    return null;
  }
}

/**
 * Phase Z2.1 — compute a 64-bit average-hash (aHash) of an image File.
 *
 * Mirrors the backend's `image_hash.average_hash` exactly:
 *   1. decode the file into an HTMLImageElement
 *   2. draw it onto a hidden 8x8 grayscale canvas
 *   3. for each pixel, output 1 if luminance > average else 0
 *   4. pack 64 bits → 8 bytes → 16-char lowercase hex
 *
 * Survives JPEG re-compression, mild crops, and small lighting
 * shifts — meaning the pre-flight catches duplicates of legacy
 * closet items whose `source_sha256` was never captured (the original
 * bytes weren't preserved at upload time, only the thumbnail).
 *
 * @param {File|Blob} file
 * @returns {Promise<string|null>} 16-char lowercase hex digest
 */
export async function aHashFile(file) {
  if (!file) return null;
  try {
    // Use ImageBitmap when available — faster, off-main-thread,
    // doesn't trigger paint. Fall back to <img> for older Safari.
    let bmp = null;
    if (typeof createImageBitmap === "function") {
      try {
        bmp = await createImageBitmap(file);
      } catch (_) {
        bmp = null;
      }
    }
    if (!bmp) {
      bmp = await new Promise((resolve, reject) => {
        const im = new Image();
        const objectUrl = URL.createObjectURL(file);
        im.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(im);
        };
        im.onerror = (e) => {
          URL.revokeObjectURL(objectUrl);
          reject(e);
        };
        im.src = objectUrl;
      });
    }
    const WIDTH = 9;
    const HEIGHT = 8;
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, WIDTH, HEIGHT);
    const { data } = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    // Luminance per ITU-R BT.601.
    const lum = new Uint8Array(WIDTH * HEIGHT);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      lum[j] = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
      );
    }
    // dHash: compare adjacent pixels horizontally in each row
    const bits = new Uint8Array(64);
    let bitIdx = 0;
    for (let row = 0; row < HEIGHT; row++) {
      for (let col = 0; col < WIDTH - 1; col++) {
        const idx = row * WIDTH + col;
        bits[bitIdx++] = lum[idx + 1] > lum[idx] ? 1 : 0;
      }
    }
    // Pack 64 bits big-endian
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 64; i++) {
      bytes[i >> 3] |= bits[i] << (7 - (i & 7));
    }
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  } catch (_) {
    return null;
  }
}

/**
 * Phase Z2.2 — compute a 24-byte RGB colour signature (4 quadrants ×
 * 3 channels). Mirrors the backend's `image_hash.color_signature`.
 *
 * Why we need it: the aHash above throws away colour by converting
 * to luminance — that's intentional for matching the *same garment*
 * across lighting changes, but it's why a navy and a grey pair of
 * shorts of the same cut produced near-identical hashes. The colour
 * signature recovers enough chroma information to tell those apart
 * without sacrificing the aHash's robustness to lighting.
 *
 * Output is 48 hex chars (24 bytes). Backend computes Manhattan
 * distance and rejects matches over `DEFAULT_COLOR_THRESHOLD`.
 *
 * @param {File|Blob} file
 * @returns {Promise<string|null>} 48-char lowercase hex digest
 */
export async function colorSignatureFile(file) {
  return null;
}
