"""
Phase Z2 — perceptual image hashing helpers.

Used by /closet/preflight to detect duplicate uploads even when:
  * the existing item's "original_image_url" was never stored (legacy
    items keep only a thumbnail / segmented preview);
  * the user re-exports their photo at a different JPEG quality;
  * the user takes a slightly different shot of the same garment
    (similar angle, similar lighting).

Implementation: a 64-bit average-hash (aHash) PLUS a small RGB colour
signature so two same-shape garments of *different colours* (e.g. navy
shorts vs grey shorts) are NOT flagged as duplicates. Cheap (~3 ms per
image on a typical pod), no extra dependencies — only Pillow + numpy,
both already in requirements.txt.

Match decision:
  * Hamming distance ≤ 6 bits on the shape hash, AND
  * Manhattan distance ≤ ``DEFAULT_COLOR_THRESHOLD`` on the colour
    signature (sum of |Δr| + |Δg| + |Δb| over the 4 quadrants,
    each channel 0–255 = max 4 × 255 × 3 = 3060).
"""

from __future__ import annotations

import base64
import io
import logging
import re
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Hash size: 8x8 = 64 bits. Yields a 16-char hex digest. Distances
# are Hamming bit-counts (max 64).
_HASH_SIZE = 8

# Default match threshold for /preflight. ≤ 6 bits (~9% of 64)
# empirically corresponds to "obvious re-upload of the same photo
# even after JPEG re-compression". Higher = more matches but more
# false positives.
DEFAULT_HAMMING_THRESHOLD = 10

# Stricter threshold used ONLY when the colour gate cannot apply
# (either side missing ``source_color_sig``). 8×8 aHash on
# greyscale is essentially "silhouette + brightness pattern": two
# *different* white garments on contrasting backgrounds reliably
# land within Hamming 4–6 of each other because both reduce to
# "bright blob centre, darker corners". The colour gate normally
# rescues that case, but legacy items predate the Z2.2 colour-sig
# backfill and ship with ``source_color_sig=None``. Without
# tightening here, every photo of a white garment uploaded into a
# closet that contains *any* pre-Z2.2 white garment ends up
# flagged as a duplicate — which is the
# ``White polo == White graphic tee`` bug observed in production.
# 3 bits ≈ 4.7%: empirically separates "re-upload of the same
# photo with JPEG re-encoding" (≤ 3) from "different garment,
# similar shape" (≥ 5).
DEFAULT_HAMMING_THRESHOLD_STRICT = 3

# Colour signature: average RGB per quadrant → 4 quadrants × 3 channels
# = 12 bytes = 24 hex chars. Manhattan distance is on the raw byte
# values (0–255). 220 ≈ "noticeably different colour family" empirically:
# navy↔grey scores ~600+, two photos of the same navy garment under
# different lighting score ~80–150.
_COLOR_GRID = 2  # 2x2 grid of quadrants
DEFAULT_COLOR_THRESHOLD = 180


_DATA_URL_RE = re.compile(r"^data:image/[^;]+;base64,(.*)$", re.I)


def _decode_to_rgba(image_data: str | bytes | None) -> Optional[Image.Image]:
    """Accept a data URL string, bare base64 string, or raw bytes. Returns RGBA PIL Image."""
    if image_data is None:
        return None
    try:
        if isinstance(image_data, bytes):
            raw = image_data
        else:
            m = _DATA_URL_RE.match(image_data.strip())
            payload = m.group(1) if m else image_data.strip()
            raw = base64.b64decode(payload, validate=False)
        img = Image.open(io.BytesIO(raw))
        return img.convert("RGBA") if img.mode != "RGBA" else img
    except Exception as exc:  # noqa: BLE001
        logger.debug("image_hash decode failed: %s", exc)
        return None


def _decode_to_pil(image_data: str | bytes | None) -> Optional[Image.Image]:
    """Decode input bytes/base64 into an RGB PIL Image or return None on failure."""
    rgba = _decode_to_rgba(image_data)
    if rgba is None:
        return None
    return rgba.convert("RGB")


def _dhash_from_rgba(rgba: Image.Image) -> Optional[str]:
    try:
        # Composite semi-transparent pixels over neutral white for stable studio dHash
        rgb = Image.new("RGB", rgba.size, (255, 255, 255))
        rgb.paste(rgba, mask=rgba.split()[3])
        small = rgb.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
        arr = np.asarray(small, dtype=np.uint8)
        diff = arr[:, 1:] > arr[:, :-1]
        bits = diff.flatten().astype(np.uint8)
        packed = np.packbits(bits)
        return packed.tobytes().hex()
    except Exception as exc:  # noqa: BLE001
        logger.debug("dhash compute failed: %s", exc)
        return None


def _color_sig_from_rgba(rgba: Image.Image) -> Optional[str]:
    """Compute foreground-masked 2x2 quadrant median RGB signature (24 hex chars)."""
    try:
        small = rgba.resize((32, 32), Image.Resampling.BILINEAR)
        arr = np.asarray(small, dtype=np.uint8)
        rgb = arr[:, :, :3]
        alpha = arr[:, :, 3]

        # Build foreground mask: ignore transparent matting and uniform white backdrop
        has_alpha_bg = bool(np.any(alpha < 128) and np.any(alpha >= 128))
        mask = (alpha >= 128) if has_alpha_bg else np.ones(alpha.shape, dtype=bool)
        near_white = (rgb[:, :, 0] >= 245) & (rgb[:, :, 1] >= 245) & (rgb[:, :, 2] >= 245)
        non_white_fg = mask & (~near_white)
        if int(np.sum(non_white_fg)) >= 80:
            mask = non_white_fg

        if np.any(mask):
            global_fg = np.median(rgb[mask], axis=0)
        else:
            global_fg = np.median(rgb.reshape(-1, 3), axis=0)

        out_bytes = bytearray()
        h, w = rgb.shape[:2]
        hy, hx = h // 2, w // 2
        for y0, y1 in ((0, hy), (hy, h)):
            for x0, x1 in ((0, hx), (hx, w)):
                q_mask = mask[y0:y1, x0:x1]
                if int(np.sum(q_mask)) >= 8:
                    q_rgb = np.median(rgb[y0:y1, x0:x1][q_mask], axis=0)
                else:
                    q_rgb = global_fg
                out_bytes.extend(int(np.clip(round(float(c)), 0, 255)) for c in q_rgb)
        return bytes(out_bytes).hex()
    except Exception as exc:  # noqa: BLE001
        logger.debug("color_signature compute failed: %s", exc)
        return None


def average_hash(image_data) -> Optional[str]:
    """Compute a 64-bit difference-hash (dHash) of the given image as 16 hex chars."""
    rgba = _decode_to_rgba(image_data)
    if rgba is None:
        return None
    return _dhash_from_rgba(rgba)


def color_signature(image_data) -> Optional[str]:
    """Compute a foreground-masked 2x2 quadrant RGB signature (24 hex chars)."""
    rgba = _decode_to_rgba(image_data)
    if rgba is None:
        return None
    return _color_sig_from_rgba(rgba)


def compute_signatures(image_data) -> tuple[str | None, str | None]:
    """Decode the image once and return both (dHash, foreground color signature)."""
    rgba = _decode_to_rgba(image_data)
    if rgba is None:
        return (None, None)
    return (_dhash_from_rgba(rgba), _color_sig_from_rgba(rgba))


# ── Phase Z2.3 — authoritative source selection ────────────────────
# ``best_authoritative_source`` and ``compute_authoritative_signatures``
# are the *correct* way for any backfill / repair / migration code to
# pull bytes off a closet item: ground truth FIRST, never the
# downscaled thumbnail. See the long comment in
# ``app/api/v1/closet.py`` /preflight backfill for why.
#
# ``thumbnail_data_url`` is *deliberately* excluded — phashes computed
# from the lossy thumbnail trivially collide across two visually
# different garments of similar overall colour (e.g. any two white
# tops), which is the documented production bug this helper exists to
# prevent recurrence of.

# Field-priority chain used by the repair pipeline + any future
# backfill caller. Order matters: the first non-empty wins.
import hashlib

AUTHORITATIVE_SOURCE_FIELDS: tuple[str, ...] = (
    "clean_image_url",
    "cutout_url",
    "reconstructed_image_url",
    "segmented_image_url",
    "original_image_url",
    "thumbnail_data_url",
    "image_url",
)


def compute_sha256(image_data: str | bytes | None) -> str | None:
    """Compute SHA-256 hex digest of raw image bytes."""
    if image_data is None:
        return None
    try:
        if isinstance(image_data, bytes):
            return hashlib.sha256(image_data).hexdigest()
        m = _DATA_URL_RE.match(image_data.strip())
        payload = m.group(1) if m else image_data.strip()
        raw = base64.b64decode(payload, validate=False)
        return hashlib.sha256(raw).hexdigest()
    except Exception:
        return None


def best_authoritative_source(row: dict) -> str | None:
    """Return the first authoritative image source on a closet item,
    falling back to clean_image_url or thumbnail_data_url.
    """
    if not isinstance(row, dict):
        return None
    for field in AUTHORITATIVE_SOURCE_FIELDS:
        val = row.get(field)
        if isinstance(val, str) and val:
            return val
    return None


def compute_authoritative_signatures(
    row: dict,
) -> tuple[str | None, str | None, str | None]:
    """Compute (phash, color_sig, source_field_used) from the best
    authoritative source on a closet item.
    """
    for field in AUTHORITATIVE_SOURCE_FIELDS:
        val = row.get(field) if isinstance(row, dict) else None
        if not isinstance(val, str) or not val:
            continue
        ph, cs = compute_signatures(val)
        if ph or cs:
            return (ph, cs, field)
    return (None, None, None)





def hamming_distance(a: str | None, b: str | None) -> int:
    """Hamming bit-distance between two 16-char hex digests. Returns
    a sentinel (65) for any malformed input so callers can treat it
    as "not a match" without special-casing."""
    if not a or not b or len(a) != len(b):
        return 65
    try:
        ai = int(a, 16)
        bi = int(b, 16)
        return (ai ^ bi).bit_count()
    except ValueError:
        return 65


def color_distance(a: str | None, b: str | None) -> int:
    """Manhattan distance between two colour signatures (24 hex chars
    each). Returns a sentinel (10_000) for malformed input. Range:
    0 (identical) to 4 × 3 × 255 = 3060 (full spectrum apart).

    We use Manhattan over Euclidean because each channel is bounded
    and the threshold is easier to reason about: ~220 ≈ "different
    colour family across the garment surface".
    """
    if not a or not b or len(a) != len(b):
        return 10_000
    try:
        ab = bytes.fromhex(a)
        bb = bytes.fromhex(b)
    except ValueError:
        return 10_000
    return int(sum(abs(int(x) - int(y)) for x, y in zip(ab, bb, strict=False)))


def is_duplicate_match(
    sha_a: str | None,
    sha_b: str | None,
    phash_a: str | None,
    phash_b: str | None,
    color_a: str | None = None,
    color_b: str | None = None,
    *,
    hamming_threshold: int = DEFAULT_HAMMING_THRESHOLD,
    hamming_threshold_strict: int = DEFAULT_HAMMING_THRESHOLD_STRICT,
    color_threshold: int = DEFAULT_COLOR_THRESHOLD,
) -> bool:
    """Check duplicate matches using SHA-256 and dHash."""
    if sha_a and sha_b and sha_a == sha_b:
        return True
    if not phash_a or not phash_b:
        return False
    dist = hamming_distance(phash_a, phash_b)
    if color_a and color_b:
        if dist <= hamming_threshold:
            return color_distance(color_a, color_b) <= color_threshold
        return False
    return dist <= hamming_threshold_strict
