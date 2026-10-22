"""
Reconstructs all 52 onboarding starter capsule garments using DressApp's Nano Banana
reconstructor (gemini-3.1-flash-lite-image):
1. Takes each garment's clean-cut image ({id}_cutout.png),
2. Prompts Nano Banana to fill all holes/gaps, uncross/straighten limbs, and repose
   the garment as a symmetrical, front-facing top-down studio flat-lay (as if shot
   spread flat on the floor) to fit the avatar's front view and DressApp's 3:4 card format,
3. Extracts a 100% transparent RGBA cutout fitted to 600x800 ({id}_cutout.png),
   saves the matching studio card ({id}.jpg), fits the flat-lay cutout onto the
   Default Avatar's 400x900 canvas ({id}.png), and updates `onboardingDataset.js`.
"""
import asyncio
import base64
import io
import json
import os
import re
import shutil
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
from rembg import remove, new_session

sys.path.insert(0, "c:/DressApp_AG/backend")
sys.path.insert(0, "c:/DressApp_AG/scripts")
from app.config import settings
settings.ENABLE_RECONSTRUCTION = True
from app.services.gemini_image_service import GeminiImageService
from fit_onboarding_garments_to_avatar import compute_avatar_geometry, build_point_cloud_mesh

REPO_ROOT = Path("c:/DressApp_AG")
ASSETS_DIR = REPO_ROOT / "apps" / "web" / "public" / "assets" / "onboarding"
NB_RAW_DIR = ASSETS_DIR / "_nano_banana_raw"
NB_RAW_DIR.mkdir(parents=True, exist_ok=True)
DATASET_JS_PATH = REPO_ROOT / "apps" / "web" / "src" / "lib" / "onboardingDataset.js"

_REMBG_SESSION = None


def get_rembg_session():
    global _REMBG_SESSION
    if _REMBG_SESSION is None:
        _REMBG_SESSION = new_session("u2net")
    return _REMBG_SESSION


# Garments that are predominantly white/off-white or have a white inner shirt in the V-neck
REMBG_WHITE_GARMENT_IDS = {
    "w_tshirt_white_crew",
    "m_tshirt_white_crew",
    "m_polo_white",
    "w_top_white_longsleeve",
    "m_guayabera_linen",
    "w_blouse_stand_collar",
    "m_pants_white_linen",
    "m_thobe_white",
    "w_jalabiya_kurta_set",
    "m_suit_navy_three_piece",
}


def build_flatlay_repose_prompt(item: dict) -> str:
    title = item.get("name") or item.get("sub_category") or "garment"
    category = item.get("category") or "Top"
    sub_cat = item.get("sub_category") or category
    colors = ", ".join(
        item.get("color_names")
        or [c.get("name", "") for c in (item.get("colors") or []) if isinstance(c, dict)]
    )
    materials = ", ".join(
        item.get("material_names")
        or [m.get("material", "") for m in (item.get("fabric_materials") or []) if isinstance(m, dict)]
    )
    pattern = item.get("pattern") or "solid"
    caption = item.get("caption") or ""

    if category == "Footwear":
        pose_instruction = (
            "Reconstruct and repose this exact pair of footwear into a clean, symmetrical, front-facing top-down "
            "studio product photograph as if placed neatly side-by-side on a flat studio floor, filling any missing "
            "parts or gaps."
        )
    elif category == "Bottom":
        pose_instruction = (
            "Reconstruct and repose this exact bottom garment so it looks as if the shot was taken directly from above "
            "while lying spread flat on the floor (top-down studio flat-lay). Completely fill all holes, pocket cutouts, "
            "and missing hip/waistband gaps with matching fabric. Straighten both legs/sides symmetrically side-by-side "
            "(completely uncrossed, vertical front view, waistband level at top, hems level at bottom) to fit a "
            "front-facing 2D avatar silhouette and a 3:4 vertical closet card."
        )
    elif category == "Outerwear":
        pose_instruction = (
            "Reconstruct and repose this exact outerwear garment so it looks as if the shot was taken directly from above "
            "while lying spread flat on the floor (top-down studio flat-lay). Completely fill all holes, gaps, inner back "
            "neck lining, and front closure (close or neatly align the front panels so there is no empty gap in the chest) "
            "using the exact matching fabric weave and color. Spread the garment flat, symmetrical, and strictly "
            "front-facing (collar at top, hem at bottom, sleeves naturally spread out straight at a gentle angle to match "
            "a front-facing avatar pose) in a 3:4 vertical portrait frame. Do NOT include any inner shirt or undershirt."
        )
    else:
        pose_instruction = (
            "Reconstruct and repose this exact garment so it looks as if the shot was taken directly from above while "
            "lying spread flat on the floor (top-down studio flat-lay). Completely fill all holes, gaps, and missing "
            "sections (such as side seams, collar, inner back neck, or hem where hands/arms were removed) with the exact "
            "matching fabric weave and pattern. Spread the garment flat, symmetrical, and strictly front-facing "
            "(collar at top, hem at bottom, sleeves naturally spread out straight at a gentle angle to match a "
            "front-facing avatar pose) in a 3:4 vertical portrait frame."
        )

    return (
        f"Studio e-commerce flat-lay product photograph of a single isolated {sub_cat}: {title} "
        f"({colors}, {materials}, {pattern}). Visual details: {caption}. "
        f"{pose_instruction} "
        "Preserve the exact color, fabric texture, pattern, buttons, embroidery, and stitching from the reference image. "
        "Place on a pure uniform solid white studio background (#FFFFFF) with zero cast shadows, zero mannequins, "
        "zero hangers, zero human body parts, and zero tags."
    )


def matte_white_flatlay_to_rgba(raw_bytes: bytes, oid: str = "") -> Image.Image:
    """
    Extracts a clean RGBA cutout from a Nano Banana studio flat-lay image.
    Uses neural U2Net matting (`rembg`) for white/off-white garments or garments with white inner shirts,
    and adaptive border-color floodfill + enclosed-hole detection for non-white garments.
    """
    if oid in REMBG_WHITE_GARMENT_IDS:
        out_bytes = remove(raw_bytes, session=get_rembg_session())
        return Image.open(io.BytesIO(out_bytes)).convert("RGBA")

    im = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    arr = np.array(im)
    H, W, _ = arr.shape
    rgb_f = arr.astype(np.float32)
    r, g, b = arr[:, :, 0].astype(np.int16), arr[:, :, 1].astype(np.int16), arr[:, :, 2].astype(np.int16)

    border_rgb = np.concatenate([
        rgb_f[0, :], rgb_f[H - 1, :], rgb_f[:, 0], rgb_f[:, W - 1]
    ], axis=0)
    bg_color = np.median(border_rgb, axis=0)
    dist = np.sqrt(np.sum((rgb_f - bg_color) ** 2, axis=2))

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = max_c - min_c
    lum = (r + g + b) // 3

    center_patch_dist = dist[int(H * 0.35):int(H * 0.65), int(W * 0.35):int(W * 0.65)]
    is_white_garment = float(np.median(center_patch_dist)) < 42.0
    if is_white_garment:
        out_bytes = remove(raw_bytes, session=get_rembg_session())
        return Image.open(io.BytesIO(out_bytes)).convert("RGBA")

    bg_cand = (dist <= 34.0) | ((lum >= 220) & (sat <= 12) & (dist <= 46.0))

    labeled, n_bg = ndimage.label(bg_cand)
    border_labels = set(np.unique(np.concatenate([
        labeled[0, :], labeled[-1, :], labeled[:, 0], labeled[:, -1]
    ])))
    border_labels.discard(0)

    if n_bg > 1:
        for comp_id in range(1, n_bg + 1):
            if comp_id in border_labels:
                continue
            comp_mask = labeled == comp_id
            if comp_mask.sum() >= 90 and dist[comp_mask].mean() <= 28.0 and sat[comp_mask].mean() <= 10:
                border_labels.add(comp_id)

    exterior_bg = np.isin(labeled, list(border_labels))
    fg = ~exterior_bg

    fg_lab, n_fg = ndimage.label(fg)
    if n_fg > 1:
        sizes = ndimage.sum(fg, fg_lab, range(1, n_fg + 1))
        max_sz = float(np.max(sizes))
        keep_ids = [i + 1 for i, sz in enumerate(sizes) if sz >= 0.04 * max_sz]
        fg = np.isin(fg_lab, keep_ids)

    fg_eroded = ndimage.binary_erosion(fg, iterations=1)
    alpha_u8 = (fg_eroded.astype(np.uint8) * 255)
    alpha_smooth = np.array(Image.fromarray(alpha_u8, mode="L").filter(ImageFilter.GaussianBlur(radius=0.8)))

    rim = fg & (~ndimage.binary_erosion(fg, iterations=3))
    interior = ndimage.binary_erosion(fg, iterations=3)
    rgb_clean = arr.copy()
    if interior.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~interior, return_indices=True)
        rgb_clean[rim] = arr[iy[rim], ix[rim]]

    rgb_clean[alpha_smooth < 8] = 0
    alpha_smooth[alpha_smooth < 8] = 0
    return Image.fromarray(np.dstack([rgb_clean, alpha_smooth]), mode="RGBA")


def fit_rgba_to_600x800_card(rgba_cutout: Image.Image, canvas_w: int = 600, canvas_h: int = 800) -> Image.Image:
    """
    Crops tight to the non-transparent garment bounding box and scales with a 0.90 safety
    margin onto a 600x800 transparent RGBA card WITHOUT filling enclosed armhole/strap holes.
    """
    arr = np.array(rgba_cutout)
    ys, xs = np.where(arr[:, :, 3] > 20)
    if len(xs) > 10 and len(ys) > 10:
        cropped = rgba_cutout.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    else:
        cropped = rgba_cutout

    iw, ih = cropped.size
    scale = min(canvas_w * 0.90 / float(max(1, iw)), canvas_h * 0.90 / float(max(1, ih)))
    new_w = max(1, int(round(iw * scale)))
    new_h = max(1, int(round(ih * scale)))
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    ox = (canvas_w - new_w) // 2
    oy = (canvas_h - new_h) // 2
    canvas.paste(resized, (ox, oy), mask=resized)
    return canvas


def fit_flatlay_cutout_to_avatar_400x900(item: dict, rgba_cutout: Image.Image) -> Image.Image:
    """
    Fits the Nano Banana reconstructed flat-lay cutout onto the Default Avatar's
    400x900 canvas (2x supersampled 200x450 SVG viewBox) so that `{id}.png`
    (`avatar_overlay_url`) displays the real reconstructed flat-lay garment aligned
    to the avatar's shoulders, waist, hips, A-stance legs, and feet.
    """
    SCALE = 2.0
    CW, CH = 400, 900
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

    arr = np.array(rgba_cutout)
    ys, xs = np.where(arr[:, :, 3] > 25)
    if len(xs) < 10 or len(ys) < 10:
        return canvas

    crop = rgba_cutout.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    crop_w, crop_h = crop.size
    crop_arr = np.array(crop)
    alpha = crop_arr[:, :, 3]

    sex = item.get("sex", "female")
    is_male = str(sex).lower() == "male"
    g = compute_avatar_geometry(sex=sex)
    x0 = g["x0"]  # 100.0

    cat = item.get("category", "Top")
    text = f"{item.get('name', '')} {item.get('sub_category', '')} {item.get('item_type', '')} {cat}".lower()

    if cat == "Footwear":
        is_boot = "boot" in text or "chelsea" in text
        y_top = g["yAnkles"] - (6.5 if is_boot else 2.5)
        y_bot = g["yFeet"] + 2.8
        foot_in = max(2.0, min(g["wInnerAnkle"], g["wFootHeel"]) - 2.0)
        foot_out = g["wFootTip"] + 2.2
        shoe_w = max(8, int(round((foot_out - foot_in) * SCALE)))
        shoe_h = max(8, int(round((y_bot - y_top) * SCALE)))
        dy = int(round(y_top * SCALE))
        dx_left = int(round((x0 - foot_out) * SCALE))
        dx_right = int(round((x0 + foot_in) * SCALE))

        mid_x = crop_w // 2
        left_half = crop.crop((0, 0, mid_x, crop_h))
        right_half = crop.crop((mid_x, 0, crop_w, crop_h))

        la = np.array(left_half)[:, :, 3]
        lys, lxs = np.where(la > 25)
        if len(lxs) > 5:
            left_shoe = left_half.crop((int(lxs.min()), int(lys.min()), int(lxs.max()) + 1, int(lys.max()) + 1))
        else:
            left_shoe = left_half

        ra = np.array(right_half)[:, :, 3]
        rys, rxs = np.where(ra > 25)
        if len(rxs) > 5:
            right_shoe = right_half.crop((int(rxs.min()), int(rys.min()), int(rxs.max()) + 1, int(rys.max()) + 1))
        else:
            right_shoe = right_half

        ls_resized = left_shoe.resize((shoe_w, shoe_h), Image.Resampling.LANCZOS)
        rs_resized = right_shoe.resize((shoe_w, shoe_h), Image.Resampling.LANCZOS)
        canvas.paste(ls_resized, (dx_left, dy), mask=ls_resized)
        canvas.paste(rs_resized, (dx_right, dy), mask=rs_resized)
        return canvas

    if cat == "Bottom":
        is_skirt = "skirt" in text
        if is_skirt:
            y_top = g["yWaist"]
            y_bot = (g["yKnees"] + 10.0) if "denim" in text else (g["yKnees"] + 24.0)
            top_band = alpha[: max(2, int(crop_h * 0.14)), :]
            tys, txs = np.where(top_band > 40)
            waist_span_u = float(txs.max() - txs.min() + 1) / float(crop_w) if len(txs) > 4 else 0.58
            waist_span_u = max(0.32, min(0.92, waist_span_u))
            target_waist_svg_w = 2.0 * (g["wWaist"] + 2.5)
            full_svg_w = max(56.0, min(145.0, target_waist_svg_w / waist_span_u))
            dw = max(12, int(round(full_svg_w * SCALE)))
            dh = max(12, int(round((y_bot - y_top) * SCALE)))
            dx = int(round((x0 - 0.5 * full_svg_w) * SCALE))
            dy = int(round(y_top * SCALE))
            resized = crop.resize((dw, dh), Image.Resampling.LANCZOS)
            canvas.paste(resized, (dx, dy), mask=resized)
            return canvas

        # Trousers / Chinos / Jeans / Loose Pants
        is_high = "tailored" in text or "dress" in text or "loose" in text or "wide" in text
        rise_ratio = 0.08 if is_high else 0.30
        y_top = g["yWaist"] + rise_ratio * (g["yHip"] - g["yWaist"])
        y_bot = g["yAnkles"] + 2.0
        y_crotch_svg = g["yCrotch"] + (2.5 if "loose" in text or "relaxed" in text else 1.0)

        hip_band = alpha[int(crop_h * 0.12): int(crop_h * 0.30), :]
        hys, hxs = np.where(hip_band > 40)
        pelvis_span_u = float(hxs.max() - hxs.min() + 1) / float(crop_w) if len(hxs) > 4 else 0.78
        pelvis_span_u = max(0.42, min(0.96, pelvis_span_u))
        target_pelvis_svg_w = 2.0 * (g["wHip"] + (3.2 if "loose" in text else 1.8))
        full_svg_w = max(62.0, min(148.0, target_pelvis_svg_w / pelvis_span_u))

        dw = max(12, int(round(full_svg_w * SCALE)))
        dh = max(12, int(round((y_bot - y_top) * SCALE)))
        resized = crop.resize((dw, dh), Image.Resampling.LANCZOS)
        res_arr = np.array(resized)

        dy0 = int(round(y_top * SCALE))
        dx0 = int(round((x0 - 0.5 * full_svg_w) * SCALE))
        crotch_row = int(round((y_crotch_svg - y_top) * SCALE))
        max_shift_px = (5.5 if is_male else 7.0) * SCALE

        out_arr = np.zeros((CH, CW, 4), dtype=np.uint8)
        mid_col = dw // 2
        for r in range(dh):
            cy = dy0 + r
            if cy < 0 or cy >= CH:
                continue
            if r <= crotch_row or dh <= crotch_row + 2:
                x_start = dx0
                c0 = max(0, x_start)
                c1 = min(CW, x_start + dw)
                if c1 > c0:
                    out_arr[cy, c0:c1] = res_arr[r, c0 - x_start: c1 - x_start]
            else:
                u_leg = float(r - crotch_row) / float(max(1, dh - crotch_row))
                shift = int(round(u_leg * max_shift_px))
                # Left leg shifted left
                lx0 = dx0 - shift
                lc0 = max(0, lx0)
                lc1 = min(CW, lx0 + mid_col)
                if lc1 > lc0:
                    out_arr[cy, lc0:lc1] = res_arr[r, lc0 - lx0: lc1 - lx0]
                # Right leg shifted right
                rx0 = dx0 + mid_col + shift
                rc0 = max(0, rx0)
                rc1 = min(CW, rx0 + (dw - mid_col))
                if rc1 > rc0:
                    res_slice = res_arr[r, mid_col + (rc0 - rx0): mid_col + (rc1 - rx0)]
                    mask = res_slice[:, 3] > out_arr[cy, rc0:rc1, 3]
                    out_arr[cy, rc0:rc1][mask] = res_slice[mask]

        return Image.fromarray(out_arr, mode="RGBA")

    # Tops, Outerwear, and Full Body (Abaya, Kaftan, Kurta Set, Saree, Dress, Jumpsuit, Thobe, Suit)
    y_top = g["yChin"] - 0.6
    ease_mult = 1.08 if cat == "Outerwear" else 1.03

    if cat == "Full Body":
        is_maxi = any(k in text for k in ("abaya", "kaftan", "jalabiya", "kurta", "saree", "jumpsuit", "thobe", "suit"))
        y_bot = (g["yAnkles"] + 3.0) if is_maxi else (g["yKnees"] + 6.0)
    elif cat == "Outerwear":
        is_long = any(k in text for k in ("trench", "cardigan", "achkan"))
        y_bot = (g["yKnees"] + 14.0) if is_long else (g["yHip"] + 9.0)
    else:
        is_long_top = any(k in text for k in ("tunic", "kurta"))
        y_bot = (g["yCrotch"] + 26.0) if is_long_top else (g["yHip"] + 3.0)

    # Estimate core shoulder/torso span relative to full flat-lay width (which includes spread sleeves)
    is_sleeveless = any(k in text for k in ("waistcoat", "vest", "sleeveless", "sheath", "jumpsuit"))
    is_short_sleeve = any(k in text for k in ("t-shirt", "tee", "polo", "guayabera", "relaxed white", "short-sleeve"))
    if is_sleeveless:
        core_shoulder_span_u = 0.86
    elif is_short_sleeve:
        core_shoulder_span_u = 0.66
    else:
        core_shoulder_span_u = 0.62

    target_shoulder_half_w = (g["wShoulders"] + 4.0) * ease_mult + 2.2
    full_svg_w = max(68.0, min(168.0, (2.0 * target_shoulder_half_w) / core_shoulder_span_u))

    dw = max(12, int(round(full_svg_w * SCALE)))
    dh = max(12, int(round((y_bot - y_top) * SCALE)))
    dx = int(round((x0 - 0.5 * full_svg_w) * SCALE))
    dy = int(round(y_top * SCALE))

    resized = crop.resize((dw, dh), Image.Resampling.LANCZOS)
    canvas.paste(resized, (dx, dy), mask=resized)
    return canvas


def _safe_write_bytes(path: Path, data: bytes):
    import time
    for attempt in range(5):
        try:
            path.write_bytes(data)
            return
        except OSError:
            time.sleep(0.3 * (attempt + 1))
    path.write_bytes(data)


def save_card_and_avatar_assets(oid: str, item: dict, raw_nb_bytes: bytes) -> dict:
    rgba_cutout = matte_white_flatlay_to_rgba(raw_nb_bytes, oid=oid)
    card_im = fit_rgba_to_600x800_card(rgba_cutout, canvas_w=600, canvas_h=800)

    png_buf = io.BytesIO()
    card_im.save(png_buf, format="PNG", optimize=True)
    cutout_path = ASSETS_DIR / f"{oid}_cutout.png"
    _safe_write_bytes(cutout_path, png_buf.getvalue())

    studio_bg = Image.new("RGBA", card_im.size, (245, 245, 244, 255))
    studio_jpg = Image.alpha_composite(studio_bg, card_im).convert("RGB")
    jpg_buf = io.BytesIO()
    studio_jpg.save(jpg_buf, format="JPEG", quality=92, optimize=True)
    _safe_write_bytes(ASSETS_DIR / f"{oid}.jpg", jpg_buf.getvalue())

    # Also build the 400x900 Default Avatar fitted overlay PNG ({id}.png) from the Nano Banana cutout
    full_400x900 = fit_flatlay_cutout_to_avatar_400x900(item, card_im)
    arr = np.array(full_400x900)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 12)
    pad = 4
    if len(xs) > 4 and len(ys) > 4:
        min_x = max(0, int(xs.min()) - pad)
        max_x = min(399, int(xs.max()) + pad)
        min_y = max(0, int(ys.min()) - pad)
        max_y = min(899, int(ys.max()) + pad)
    else:
        min_x, min_y, max_x, max_y = 60, 180, 340, 620

    cropped_avatar_png = full_400x900.crop((min_x, min_y, max_x + 1, max_y + 1))
    av_buf = io.BytesIO()
    cropped_avatar_png.save(av_buf, format="PNG", optimize=True)
    _safe_write_bytes(ASSETS_DIR / f"{oid}.png", av_buf.getvalue())

    default_viewbox = {
        "x": round(min_x / 2.0, 2),
        "y": round(min_y / 2.0, 2),
        "width": round((max_x - min_x + 1) / 2.0, 2),
        "height": round((max_y - min_y + 1) / 2.0, 2),
    }
    point_cloud = build_point_cloud_mesh(
        item,
        default_viewbox=default_viewbox,
        alpha_crop=np.array(cropped_avatar_png)[:, :, 3],
    )
    return {
        "fitted_to_default_avatar": True,
        "avatar_version": "nb_flatlay_v1",
        "fit_mode": "photo_contour",
        "default_sex": item.get("sex", "female"),
        "default_viewbox": default_viewbox,
        "point_cloud": point_cloud,
    }


async def process_one(idx: int, total: int, oid: str, item: dict, svc: GeminiImageService, sem: asyncio.Semaphore, force: bool = False):
    raw_cache = NB_RAW_DIR / f"{oid}.png"
    async with sem:
        if raw_cache.exists() and not force:
            raw_nb_bytes = raw_cache.read_bytes()
            avatar_fit = save_card_and_avatar_assets(oid, item, raw_nb_bytes)
            item["image_url"] = f"/assets/onboarding/{oid}_cutout.png"
            item["avatar_overlay_url"] = f"/assets/onboarding/{oid}.png?v=nb1"
            item["avatar_fit"] = avatar_fit
            print(f"[{idx:2d}/{total}] [CACHED->CARD+AVATAR] {oid:28s} ({len(raw_nb_bytes)//1024} KB)", flush=True)
            return

        prompt = build_flatlay_repose_prompt(item)
        cutout_path = ASSETS_DIR / f"{oid}_cutout.png"
        im = Image.open(cutout_path).convert("RGBA")
        white_bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        comp = Image.alpha_composite(white_bg, im).convert("RGB")
        buf = io.BytesIO()
        comp.save(buf, format="JPEG", quality=95)

        res = await svc.edit(buf.getvalue(), prompt, garment_metadata=item)
        raw_nb_bytes = base64.b64decode(res["image_b64"])
        _safe_write_bytes(raw_cache, raw_nb_bytes)
        avatar_fit = save_card_and_avatar_assets(oid, item, raw_nb_bytes)
        item["image_url"] = f"/assets/onboarding/{oid}_cutout.png"
        item["avatar_overlay_url"] = f"/assets/onboarding/{oid}.png?v=nb1"
        item["avatar_fit"] = avatar_fit
        print(f"[{idx:2d}/{total}] [NANO-BANANA]         {oid:28s} -> {oid}_cutout.png ({len(raw_nb_bytes)//1024} KB)", flush=True)


async def main():
    svc = GeminiImageService(api_key=settings.GEMINI_API_KEY)
    raw_js = DATASET_JS_PATH.read_text(encoding="utf-8")
    start_marker = "export const ONBOARDING_STATIC_DATASET = "
    start_idx = raw_js.index(start_marker) + len(start_marker)
    end_idx = raw_js.index(";\n\nexport const WOMEN_ONBOARDING_DATASET")
    items = json.loads(raw_js[start_idx:end_idx])

    only_ids = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    force = bool(only_ids)
    sem = asyncio.Semaphore(4)

    tasks = []
    for idx, item in enumerate(items, 1):
        oid = item["id"].replace("onboard_", "")
        if only_ids and oid not in only_ids:
            continue
        tasks.append(process_one(idx, len(items), oid, item, svc, sem, force=force))

    await asyncio.gather(*tasks)

    header = raw_js[: raw_js.index(start_marker)]
    footer = raw_js[end_idx:]
    updated_js = f"{header}{start_marker}{json.dumps(items, indent=2, ensure_ascii=False)}{footer}"
    DATASET_JS_PATH.write_text(updated_js, encoding="utf-8")
    print("All onboarding items reconstructed, reposed, fitted to avatar, and saved to onboardingDataset.js!")


if __name__ == "__main__":
    asyncio.run(main())
