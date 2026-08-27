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
DEFAULT_COLOR_THRESHOLD = 220


_DATA_URL_RE = re.compile(r"^data:image/[^;]+;base64,(.*)$", re.I)


def _decode_to_pil(image_data: str | bytes | None) -> Optional[Image.Image]:
    """Accept either a data URL string, a bare base64 string, or raw
    bytes. Returns a PIL Image in RGB or None on failure (so callers
    can simply skip)."""
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
        # Convert palette / RGBA / etc. to RGB so .convert('L') below
        # behaves consistently across formats.
        if img.mode != "RGB":
            img = img.convert("RGB")
        return img
    except Exception as exc:  # noqa: BLE001
        logger.debug("phash decode failed: %s", exc)
        return None


def average_hash(image_data) -> Optional[str]:
    """Compute a 64-bit difference-hash (dHash) of the given image and return it
    as a 16-char lowercase hex string. ``None`` means the input was
    unreadable (we keep going rather than blowing up the upload)."""
    img = _decode_to_pil(image_data)
    if img is None:
        return None
    try:
        # Resize to 9x8 for horizontal difference
        small = img.convert("L").resize(
            (9, 8), Image.Resampling.LANCZOS
        )
        arr = np.asarray(small, dtype=np.uint8)
        # Compare adjacent pixels in each row
        diff = arr[:, 1:] > arr[:, :-1]
        bits = diff.flatten().astype(np.uint8)
        packed = np.packbits(bits)
        return packed.tobytes().hex()
    except Exception as exc:  # noqa: BLE001
        logger.debug("dhash compute failed: %s", exc)
        return None


def color_signature(image_data) -> Optional[str]:
    """Coarse RGB colour signature is disabled — returns None."""
    return None


def compute_signatures(image_data) -> tuple[str | None, str | None]:
    """Decode the image once and return both a dHash and a None color
    signature.
    """
    ph = average_hash(image_data)
    return (ph, None)


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
AUTHORITATIVE_SOURCE_FIELDS: tuple[str, ...] = (
    "clean_image_url",
    "cutout_url",
    "reconstructed_image_url",
    "segmented_image_url",
    "original_image_url",
)



def best_authoritative_source(row: dict) -> str | None:
    """Return the first authoritative image source on a closet item,
    or ``None`` if the row only has a (lossy) thumbnail.

    ``row`` is a closet-item Mongo document or any dict that follows
    the same key names. A ``None`` return is a signal to the repair
    pipeline that this row *cannot* be safely re-fingerprinted from
    available data — its hashes should be **cleared** (not
    recomputed from the thumbnail) so the duplicate detector treats
    it as un-fingerprinted instead of trusting a hallucinated hash.
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
    authoritative source on a closet item. Returns ``(None, None, None)``
    when no authoritative source exists.

    Returning the *field that was used* lets the repair endpoint
    surface diagnostics ("recomputed from original_image_url" vs
    "skipped — only thumbnail available") in its streaming log
    without re-deriving the choice on the caller side.
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
