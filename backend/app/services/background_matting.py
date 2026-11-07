"""Background matting — non-generative alpha cutout.

Phase V (Fix round 2 — April 2026):
The original plan to call BiRefNet via the HF serverless Inference API
failed in practice — `api-inference.huggingface.co` has been retired and
BiRefNet is not exposed on the new `router.huggingface.co/hf-inference`
provider ("Model not supported by provider hf-inference").

We now run matting **locally** via the excellent `rembg` library
(MIT-licensed), which bundles BiRefNet and ISNet weights behind an
onnxruntime-CPU session. First call downloads the weights (~170 MB,
cached to ~/.u2net). Subsequent calls are ~2-4 s per image on CPU.

No hallucination is possible: the model emits a per-pixel alpha mask
which we multiply into the original pixels — we never synthesise
new colour values.

Execution order:
  1. Self-hosted endpoint (`BACKGROUND_MATTING_ENDPOINT_URL`) — future
     dressapp.co GPU box.
  2. Local rembg (primary).

The CLIP faithfulness guard is retained but is now advisory — since
rembg cannot hallucinate, the only failure modes are "empty mask" (which
we detect directly) or "too much of the garment got masked out" (which
the CLIP check catches). Threshold is configurable.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import threading
import time
from typing import Any

import httpx
import numpy as np
from PIL import Image

from app.config import settings
from app.services import provider_activity

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = httpx.Timeout(60.0, connect=15.0)

# Lazy rembg session (the onnx model is heavy; load once per process).
_session_lock = threading.Lock()
_session: Any = None


def _get_session() -> Any:
    global _session
    if _session is not None:
        return _session
    with _session_lock:
        if _session is not None:
            return _session
        from rembg import new_session

        model_name = settings.BACKGROUND_MATTING_REMBG_MODEL
        t0 = time.time()
        logger.info(
            "background_matting: loading rembg session model=%s (first call, ~170MB download on first warm-up)",
            model_name,
        )
        try:
            _session = new_session(model_name=model_name)
            logger.info(
                "background_matting: rembg session ready in %.1fs",
                time.time() - t0,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "background_matting: failed to create rembg session (%s); feature disabled",
                exc,
            )
            raise
        return _session


def drop_disconnected_islands(
    image_rgba: Image.Image | bytes,
    min_area_ratio: float = 0.01,
) -> Any:
    """Filter out small stray specks, shadows, or background noise.

    Identifies all connected components of opaque/semi-opaque alpha (alpha >= 32).
    Finds the largest component (the main garment). Any secondary component whose
    pixel count is less than `min_area_ratio` (default 1%) of the dominant component
    is treated as a stray speck / artifact and zeroed out.
    """
    from scipy import ndimage

    is_bytes = isinstance(image_rgba, (bytes, bytearray))
    if is_bytes:
        im = Image.open(io.BytesIO(image_rgba)).convert("RGBA")
    else:
        im = image_rgba.convert("RGBA")

    arr = np.array(im)
    alpha = arr[:, :, 3]
    solid = alpha >= 32
    if not solid.any():
        return image_rgba

    labeled, num_features = ndimage.label(solid)
    if num_features <= 1:
        return image_rgba

    sizes = ndimage.sum(solid, labeled, range(1, num_features + 1))
    max_size = sizes.max()
    if max_size <= 0:
        return image_rgba

    dominant_idx = int(np.argmax(sizes)) + 1
    dom_mask = labeled == dominant_idx
    dist_from_dom = ndimage.distance_transform_edt(~dom_mask)

    # Secondary components that are far away from the dominant garment body
    # must have substantial mass (>= 25% of dominant) to survive (e.g. partner boot / shoe).
    # Small far-away disconnected specks (< 25% of dominant) are noise/artifacts.
    drop_indices = []
    for i, s in enumerate(sizes):
        idx = i + 1
        if idx == dominant_idx:
            continue
        comp_mask = labeled == idx
        min_dist = float(dist_from_dom[comp_mask].min()) if comp_mask.any() else 999.0
        # Tolerant proximity threshold: coiled belts, folded straps, shoe laces, or multi-piece garments
        # may have gaps up to 25px or 3% of the image dimension.
        prox_threshold = max(25.0, float(min(arr.shape[:2])) * 0.03)
        if min_dist <= prox_threshold:
            cutoff = max_size * max(min_area_ratio, 0.05)
            if s < cutoff:
                drop_indices.append(idx)
        else:
            if s < max_size * 0.25:
                drop_indices.append(idx)

    if not drop_indices:
        return image_rgba

    mask_to_drop = np.isin(labeled, drop_indices)
    arr[:, :, 3] = np.where(mask_to_drop, 0, alpha).astype(np.uint8)
    cleaned = Image.fromarray(arr, "RGBA")
    logger.info(
        "drop_disconnected_islands: filtered %d small speck(s) (<%.1f%% of dominant item, total %d px)",
        len(drop_indices),
        min_area_ratio * 100,
        int(mask_to_drop.sum()),
    )
    if is_bytes:
        buf = io.BytesIO()
        cleaned.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    return cleaned


def strip_hanger_hook(image_rgba: Image.Image | bytes) -> Image.Image | bytes:
    """Detect and zero-out thin hanger hooks and wire stalks above garment shoulders.

    Hanger hooks are typically vertical or arched metallic/plastic stalks located
    at the top of the crop (top 40% of height), centered horizontally (x between 15%
    and 85% of width), and narrow (< 45px or < 12% of crop width).
    Once the garment shoulders / collar curve begins, row width expands dramatically
    (> 2.5x the hook width, or > 20% of image width).
    This function zeroes out any narrow hook stalk directly above the shoulder apex.
    """
    is_bytes = isinstance(image_rgba, (bytes, bytearray))
    if is_bytes:
        im = Image.open(io.BytesIO(image_rgba)).convert("RGBA")
    else:
        im = image_rgba.convert("RGBA")

    arr = np.array(im)
    alpha = arr[:, :, 3]
    solid = alpha >= 32
    if not solid.any():
        return image_rgba

    Hc, Wc = alpha.shape
    y_indices, x_indices = np.where(solid)
    y_min = int(y_indices.min())

    max_scan_y = min(Hc, y_min + int(Hc * 0.35))
    narrow_threshold = min(35, max(15, int(Wc * 0.05)))
    shoulder_y = None
    hook_rows_x: list[tuple[int, int]] = []

    for y in range(y_min, max_scan_y):
        xs = np.where(solid[y, :])[0]
        if len(xs) == 0:
            continue
        w = int(xs[-1] - xs[0] + 1)
        x_center = float(xs[-1] + xs[0]) / 2.0
        # If row width exceeds narrow threshold or is broad, we have reached garment shoulders/collar
        if w > narrow_threshold or w >= max(50, int(Wc * 0.10)):
            shoulder_y = y
            break
        if 0.25 * Wc <= x_center <= 0.75 * Wc:
            hook_rows_x.append((int(xs[0]), int(xs[-1])))

    # Must be a true vertical hook stalk (at least 8 rows tall, average width <= narrow_threshold)
    if shoulder_y is not None and shoulder_y > y_min + 8 and hook_rows_x:
        widths = [x1 - x0 + 1 for x0, x1 in hook_rows_x]
        avg_w = float(np.mean(widths))
        if avg_w <= narrow_threshold:
            min_hx = max(0, min(x0 for x0, x1 in hook_rows_x) - 4)
            max_hx = min(Wc, max(x1 for x0, x1 in hook_rows_x) + 5)
            arr[max(0, y_min - 2):max(0, shoulder_y - 2), min_hx:max_hx, 3] = 0
            cleaned = Image.fromarray(arr, "RGBA")
            logger.info(
                "strip_hanger_hook: stripped hanger hook stalk above shoulder y=%d (y_min=%d, avg_w=%.1f, cols %d..%d)",
                shoulder_y, y_min, avg_w, min_hx, max_hx,
            )
            if is_bytes:
                buf = io.BytesIO()
                cleaned.save(buf, format="PNG", optimize=True)
                return buf.getvalue()
            return cleaned
        else:
            logger.debug(
                "strip_hanger_hook: candidate stalk avg_w=%.1f > %d, keeping fabric",
                avg_w, narrow_threshold,
            )

    return image_rgba


def carve_studio_background_cavities(
    image_rgba: Image.Image | bytes,
    bg_brightness_min: float = 195.0,
    bg_saturation_max: float = 0.18,
    contrast_delta_min: float = 60.0,
) -> Image.Image | bytes:
    """Detect and carve out studio background pockets in underarm/armpit gaps.

    Neural matting models (like u2net/birefnet in rembg) frequently miss narrow
    enclosed or semi-enclosed gaps between sleeves and torso on studio photos,
    assigning opaque alpha (~245) to the white studio background. This function:
      1. Verifies that the perimeter background is a bright, uniform studio backdrop.
      2. Computes the median color, brightness, and saturation of the garment fabric.
      3. Safety Guard: If the garment itself is white/cream (Delta E < contrast_delta_min
         or low saturation + high brightness), skips carving to protect white clothing.
      4. Identifies candidate gap components in the left and right underarm flank zones
         (between sleeve outer boundary and central torso column).
      5. Confirms the component has significant height/aspect or connects to the exterior,
         excluding central chest areas (preserving logos, graphics, and zipper pulls).
      6. Zeroes out the alpha of the carved gaps with gentle boundary anti-aliasing.
    """
    from scipy import ndimage

    is_bytes = isinstance(image_rgba, (bytes, bytearray))
    if is_bytes:
        im = Image.open(io.BytesIO(image_rgba)).convert("RGBA")
    else:
        im = image_rgba.convert("RGBA")

    arr = np.array(im)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3]
    H, W = alpha.shape

    solid = alpha >= 32
    if not solid.any():
        return image_rgba

    ys, xs = np.where(solid)
    y_min, y_max = int(ys.min()), int(ys.max())
    x_min, x_max = int(xs.min()), int(xs.max())
    bbox_h = y_max - y_min + 1
    bbox_w = x_max - x_min + 1

    if bbox_h < 40 or bbox_w < 40:
        return image_rgba

    # 1. Background profile: check outer perimeter (top/bottom/left/right 3% of image)
    # Only sample OPAQUE pixels (alpha >= 40). If perimeter is already transparent (< 40),
    # rembg has already removed the perimeter and we need to check missed interior cavities!
    margin_x = max(2, int(W * 0.03))
    margin_y = max(2, int(H * 0.03))
    perimeter_pixels = []
    for sample, a_sample in [
        (rgb[:margin_y, :], alpha[:margin_y, :]),
        (rgb[-margin_y:, :], alpha[-margin_y:, :]),
        (rgb[:, :margin_x], alpha[:, :margin_x]),
        (rgb[:, -margin_x:], alpha[:, -margin_x:]),
    ]:
        nz = sample[(a_sample >= 40) & (sample.sum(axis=-1) > 10)]
        if len(nz) > 0:
            perimeter_pixels.append(nz)

    if perimeter_pixels:
        all_perim = np.concatenate(perimeter_pixels, axis=0)
        p_max = all_perim.max(axis=-1).astype(float)
        p_min = all_perim.min(axis=-1).astype(float)
        p_sat = (p_max - p_min) / np.maximum(p_max, 1.0)
        p_bright = p_max
        is_studio_bg = (np.median(p_bright) >= 185.0) and (np.median(p_sat) <= 0.20)
    else:
        is_studio_bg = True

    if not is_studio_bg:
        return image_rgba

    # 2. Fabric profile: sample confident garment body pixels (alpha >= 200, within central core of bbox)
    core_torso_mask = np.zeros((H, W), dtype=bool)
    y_core_start = y_min + int(bbox_h * 0.20)
    y_core_end = y_min + int(bbox_h * 0.70)
    x_core_start = x_min + int(bbox_w * 0.30)
    x_core_end = x_max - int(bbox_w * 0.30)
    core_torso_mask[y_core_start:y_core_end, x_core_start:x_core_end] = True
    core_torso_fabric = rgb[core_torso_mask & (alpha >= 200)]

    if len(core_torso_fabric) < 100:
        core_torso_fabric = rgb[solid]

    fab_r = core_torso_fabric[:, 0].astype(float)
    fab_g = core_torso_fabric[:, 1].astype(float)
    fab_b = core_torso_fabric[:, 2].astype(float)
    fab_max = np.maximum(np.maximum(fab_r, fab_g), fab_b)
    fab_min = np.minimum(np.minimum(fab_r, fab_g), fab_b)
    fab_sat = (fab_max - fab_min) / np.maximum(fab_max, 1.0)
    fab_bright = fab_max

    med_fab_color = np.median(core_torso_fabric, axis=0)
    med_fab_sat = float(np.median(fab_sat))
    med_fab_bright = float(np.median(fab_bright))

    # Safety Guard for White / Cream / Light Gray clothing:
    # If the garment is white (Delta E < contrast_delta_min against pure white and low saturation and high brightness),
    # carving white regions risks punching holes into the chest of a white shirt!
    white_ref = np.array([250.0, 250.0, 250.0])
    color_dist = float(np.linalg.norm(med_fab_color - white_ref))
    if color_dist < contrast_delta_min and med_fab_sat < 0.15 and med_fab_bright > 185.0:
        return image_rgba

    # 3. Candidate gap pixels inside opaque region:
    # Brightness >= bg_brightness_min, saturation <= bg_saturation_max
    r = rgb[:, :, 0].astype(float)
    g = rgb[:, :, 1].astype(float)
    b = rgb[:, :, 2].astype(float)
    c_max = np.maximum(np.maximum(r, g), b)
    c_min = np.minimum(np.minimum(r, g), b)
    sat = (c_max - c_min) / np.maximum(c_max, 1.0)
    bright = c_max

    dist_to_white = np.sqrt((r - 250.0)**2 + (g - 250.0)**2 + (b - 250.0)**2)
    is_white_gap = (solid) & (bright >= bg_brightness_min) & (sat <= bg_saturation_max) & (dist_to_white < 85.0)

    # Spatial Restriction: Underarm / Armpit flank zones
    flank_mask = np.zeros((H, W), dtype=bool)
    left_flank_x1 = x_min + int(bbox_w * 0.06)
    left_flank_x2 = x_min + int(bbox_w * 0.42)
    right_flank_x1 = x_min + int(bbox_w * 0.58)
    right_flank_x2 = x_min + int(bbox_w * 0.94)
    flank_y1 = y_min + int(bbox_h * 0.20)
    flank_y2 = y_min + int(bbox_h * 0.90)

    flank_mask[flank_y1:flank_y2, left_flank_x1:left_flank_x2] = True
    flank_mask[flank_y1:flank_y2, right_flank_x1:right_flank_x2] = True

    candidate_mask = is_white_gap & flank_mask
    if not candidate_mask.any():
        return image_rgba

    labeled, num_features = ndimage.label(candidate_mask)
    if num_features == 0:
        return image_rgba

    sizes = ndimage.sum(candidate_mask, labeled, range(1, num_features + 1))
    carve_mask = np.zeros((H, W), dtype=bool)

    min_gap_area = max(20, int(bbox_h * bbox_w * 0.0003))

    for idx, s in enumerate(sizes):
        if s < min_gap_area:
            continue
        comp_mask = labeled == (idx + 1)
        c_ys, c_xs = np.where(comp_mask)
        comp_h = c_ys.max() - c_ys.min() + 1
        comp_w = c_xs.max() - c_xs.min() + 1

        if comp_h < 10 and comp_w < 10:
            continue

        carve_mask |= comp_mask

    if not carve_mask.any():
        return image_rgba

    # Gentle dilation (1-2px) to eat the antialiased boundary of the gap without touching saturated fabric
    dilated = ndimage.binary_dilation(carve_mask, iterations=2)
    is_garment_fabric = (sat > bg_saturation_max + 0.08) | (bright < bg_brightness_min - 35.0) | (dist_to_white > 100.0)
    final_carve = dilated & (~is_garment_fabric)

    arr[:, :, 3] = np.where(final_carve, 0, alpha).astype(np.uint8)
    cleaned = Image.fromarray(arr, "RGBA")
    logger.info(
        "carve_studio_background_cavities: carved %d px of studio gap in %d flank component(s)",
        int(final_carve.sum()),
        num_features,
    )

    if is_bytes:
        buf = io.BytesIO()
        cleaned.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    return cleaned


def _rembg_remove(image_bytes: bytes) -> bytes | None:
    """Blocking helper — call inside asyncio.to_thread.

    Pre-resize input to ``BACKGROUND_MATTING_MAX_EDGE`` px to keep rembg
    inference bounded in time and memory. u2netp is trained on 320x320
    inputs and rembg internally resizes anyway — running on a 4K original
    image just balloons RAM (intermediate RGBA tensors at full res can
    exceed the 3 GB container limit and cause silent OOM kills) without
    helping quality. We resize INPUT only; the alpha mask comes back at
    the resized resolution and we composite it back onto the original
    full-resolution RGB so the output keeps its sharpness.
    """
    from rembg import remove

    try:
        sess = _get_session()
        # 1) Decode original at full resolution. ImageOps.exif_transpose
        #    auto-rotates the image based on EXIF orientation tags so
        #    DSLR/phone portrait shots come through right-side-up. Without
        #    this, rembg sees the rotated content while the user sees the
        #    correctly-oriented result, producing a cutout that doesn't
        #    align with the visible garment.
        # Check whether heavy PyMatting (closed-form Laplacian linear solver) is requested.
        # Defaults to False on CPU to keep matting under 2s (alpha_matting=True takes ~40s on CPU).
        use_alpha_matting = bool(getattr(settings, "BACKGROUND_MATTING_ALPHA_MATTING", False))

        try:
            from PIL import ImageOps

            original = Image.open(io.BytesIO(image_bytes))
            original = ImageOps.exif_transpose(original).convert("RGB")
        except Exception:  # noqa: BLE001
            # Not a decodable image — let rembg attempt anyway.
            # post_process_mask=False preserves continuous anti-aliased alpha boundaries
            # without morphological erosion or binary thresholding that creates staircases and holes.
            rembg_kwargs = {"session": sess, "post_process_mask": False, "alpha_matting": use_alpha_matting}
            if use_alpha_matting:
                rembg_kwargs.update({
                    "alpha_matting_foreground_threshold": 240,
                    "alpha_matting_background_threshold": 10,
                    "alpha_matting_erode_size": 10,
                })
            out = remove(image_bytes, **rembg_kwargs)
            return out or None

        # 2) Build a downscaled copy for rembg if needed.
        max_edge = settings.BACKGROUND_MATTING_MAX_EDGE
        ow, oh = original.size
        long_edge = max(ow, oh)
        if max_edge > 0 and long_edge > max_edge:
            scale = max_edge / float(long_edge)
            sw, sh = int(ow * scale), int(oh * scale)
            small = original.resize((sw, sh), Image.LANCZOS)
            buf = io.BytesIO()
            small.save(buf, format="JPEG", quality=92)
            inference_bytes = buf.getvalue()
            logger.info(
                "rembg: resized input %dx%d → %dx%d for inference",
                ow, oh, sw, sh,
            )
        else:
            inference_bytes = image_bytes

        # 3) Run rembg — yields PNG with alpha at the inference resolution.
        # post_process_mask=False preserves continuous anti-aliased alpha boundaries
        rembg_kwargs = {"session": sess, "post_process_mask": False, "alpha_matting": use_alpha_matting}
        if use_alpha_matting:
            rembg_kwargs.update({
                "alpha_matting_foreground_threshold": 240,
                "alpha_matting_background_threshold": 10,
                "alpha_matting_erode_size": 10,
            })
        out = remove(inference_bytes, **rembg_kwargs)
        if not out:
            return None

        # 4) Composite the alpha back onto the FULL-RES original so we
        #    don't lose detail (especially on portrait shots where the
        #    user wants to read tags / fabric texture).
        try:
            small_rgba = Image.open(io.BytesIO(out)).convert("RGBA")
            alpha_small = small_rgba.split()[-1]
            if alpha_small.size != original.size:
                alpha_full = alpha_small.resize(original.size, Image.LANCZOS)
            else:
                alpha_full = alpha_small
            full_rgba = original.convert("RGBA")
            full_rgba.putalpha(alpha_full)
            full_rgba = carve_studio_background_cavities(full_rgba)
            full_rgba = drop_disconnected_islands(full_rgba, min_area_ratio=0.05)
            full_rgba = strip_hanger_hook(full_rgba)
            buf = io.BytesIO()
            full_rgba.save(buf, format="PNG", optimize=True)
            out = buf.getvalue()
        except Exception as exc:  # noqa: BLE001
            logger.info(
                "rembg: alpha-upscale composite failed (%s); using small output",
                repr(exc)[:120],
            )
            # Fall through with `out` as-is.

        # 5) Sanity: make sure we got a meaningful alpha mask, not empty.
        try:
            im = Image.open(io.BytesIO(out)).convert("RGBA")
            a = np.array(im.split()[-1])
            opaque_ratio = float((a > 32).sum()) / float(max(1, a.size))
            if opaque_ratio < 0.01:
                logger.info(
                    "background_matting: rejecting near-empty mask (opaque=%.3f)",
                    opaque_ratio,
                )
                return None
        except Exception:  # noqa: BLE001
            # If we can't inspect it, trust the bytes and return.
            pass
        return out
    except Exception as exc:  # noqa: BLE001
        logger.exception("background_matting: rembg failed (%s)", exc)
        return None


async def _call_self_hosted(image_bytes: bytes, endpoint_url: str) -> bytes | None:
    started = time.time()
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as c:
            resp = await c.post(
                endpoint_url.rstrip("/") + "/remove-background",
                files={"image": ("input.png", image_bytes, "image/png")},
            )
    except Exception as exc:  # noqa: BLE001
        logger.info("background_matting self-hosted exception: %s", exc)
        provider_activity.record(
            "background_matting",
            ok=False,
            latency_ms=int((time.time() - started) * 1000),
            extra={"provider": "self_hosted", "err": str(exc)[:80]},
        )
        return None
    provider_activity.record(
        "background_matting",
        ok=resp.status_code == 200,
        latency_ms=int((time.time() - started) * 1000),
        extra={"provider": "self_hosted"},
    )
    if resp.status_code != 200:
        return None
    ct = resp.headers.get("content-type", "")
    if ct.startswith("image/"):
        return resp.content
    try:
        body = resp.json()
    except Exception:  # noqa: BLE001
        return None
    b64 = body.get("image_png_b64") or body.get("image")
    if not b64:
        return None
    try:
        return base64.b64decode(b64.split(",", 1)[-1])
    except Exception:  # noqa: BLE001
        return None


async def _faithfulness_ok(original: bytes, matted: bytes) -> bool:
    """CLIP cosine-similarity guard. Any error → treat as OK (don't block).

    Rembg output is deterministic (same pixels, subset only) so the CLIP
    score should stay >0.85 on valid cutouts. A low score means the mask
    eroded something important.
    """
    try:
        from app.services import fashion_clip

        svc = fashion_clip._get_service()  # noqa: SLF001
        if svc is None:
            return True
        a = await svc.embed_image(original)
        
        # Composite matted PNG onto white before CLIP embedding
        try:
            matted_im = Image.open(io.BytesIO(matted)).convert("RGBA")
            white_bg = Image.new("RGB", matted_im.size, (255, 255, 255))
            white_bg.paste(matted_im, mask=matted_im)
            buf = io.BytesIO()
            white_bg.save(buf, format="JPEG", quality=90)
            matted_for_clip = buf.getvalue()
        except Exception as exc:  # noqa: BLE001
            logger.info("background_matting: composite for clip failed: %s", exc)
            matted_for_clip = matted

        b = await svc.embed_image(matted_for_clip)
        if a is None or b is None:
            return True
        a_np = np.asarray(a, dtype=np.float32)
        b_np = np.asarray(b, dtype=np.float32)
        denom = float(np.linalg.norm(a_np) * np.linalg.norm(b_np)) or 1.0
        cos = float(np.dot(a_np, b_np) / denom)
        ok = cos >= settings.MATTING_FAITHFULNESS_THRESHOLD
        logger.info(
            "background_matting faithfulness cos=%.3f threshold=%.3f ok=%s",
            cos,
            settings.MATTING_FAITHFULNESS_THRESHOLD,
            ok,
        )
        return ok
    except Exception as exc:  # noqa: BLE001
        logger.info("faithfulness check skipped: %s", exc)
        return True


async def remove_background(image_bytes: bytes) -> dict[str, Any]:
    """Return `{image_png, provider, faithful}`.

    * `image_png` is transparent-background PNG bytes, or `None` if all
      paths failed or the faithfulness guard rejected the output.
    * `provider` is `"self_hosted"` or `"local_rembg"`.
    * `faithful` reflects the CLIP sanity check.
    """
    matted: bytes | None = None
    provider: str | None = None

    if settings.BACKGROUND_MATTING_ENDPOINT_URL:
        matted = await _call_self_hosted(
            image_bytes, settings.BACKGROUND_MATTING_ENDPOINT_URL
        )
        provider = "self_hosted"

    if not matted:
        t0 = time.time()
        matted = await asyncio.to_thread(_rembg_remove, image_bytes)
        provider_activity.record(
            "background_matting",
            ok=matted is not None,
            latency_ms=int((time.time() - t0) * 1000),
            extra={
                "provider": "local_rembg",
                "model": settings.BACKGROUND_MATTING_REMBG_MODEL,
            },
        )
        if matted:
            provider = provider or "local_rembg"

    if not matted:
        return {"image_png": None, "provider": provider, "faithful": False}

    ok = await _faithfulness_ok(image_bytes, matted)
    return {
        "image_png": matted if ok else None,
        "provider": provider,
        "faithful": ok,
    }


async def matte_crop(image_bytes: bytes) -> bytes | None:
    """Lightweight variant used by the multi-item analyzer.

    Runs the same rembg pipeline but SKIPS the CLIP faithfulness guard
    (too expensive to run N times in one /analyze request) and returns
    plain PNG bytes on success or `None` on failure. Callers should
    fall back to the original bbox JPEG when this returns None.
    """
    if settings.BACKGROUND_MATTING_ENDPOINT_URL:
        remote = await _call_self_hosted(
            image_bytes, settings.BACKGROUND_MATTING_ENDPOINT_URL
        )
        if remote:
            return remote
    try:
        return await asyncio.to_thread(_rembg_remove, image_bytes)
    except Exception as exc:  # noqa: BLE001
        logger.info("matte_crop failed: %s", exc)
        return None
