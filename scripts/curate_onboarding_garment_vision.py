# -*- coding: utf-8 -*-
"""
Runs DressApp's GarmentVision pipeline (SegFormer-b3 semantic clothing parser +
rembg background matting + human/adjacent-garment excision + studio 3:4 card fitting)
once across all 52 onboarding starter capsule images.
Saves studio-grade, clean-cut garment images to:
  - {id}_cutout.png (transparent RGBA 600x800 studio card)
  - {id}.jpg        (clean studio white/neutral 600x800 JPEG card)
"""
import io
import os
import sys
import shutil
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, "/app")
from app.config import settings
settings.USE_LOCAL_CLOTHING_PARSER = True

from app.services import clothing_parser, background_matting
from app.services.vision import image as vision_image

ASSETS_DIR = Path("/tmp/onboarding_assets")
RAW_BACKUP_DIR = ASSETS_DIR / "_raw_hf"
RAW_BACKUP_DIR.mkdir(parents=True, exist_ok=True)

ITEMS_52 = [
    # Women Full Body
    ("w_abaya_black", "Full Body"),
    ("w_kaftan_emerald", "Full Body"),
    ("w_jalabiya_kurta_set", "Full Body"),
    ("w_saree_maroon", "Full Body"),
    ("w_dress_sheath_black", "Full Body"),
    ("w_jumpsuit_black", "Full Body"),
    # Women Skirts & Pants (Bottom)
    ("w_skirt_pleated_midi", "Bottom"),
    ("w_skirt_aline_grey", "Bottom"),
    ("w_skirt_denim_pleated", "Bottom"),
    ("w_trousers_tailored_grey", "Bottom"),
    ("w_pants_loose_olive", "Bottom"),
    ("w_chinos_beige", "Bottom"),
    ("w_jeans_blue", "Bottom"),
    # Women Tops & T-Shirts
    ("w_tunic_mandarin_green", "Top"),
    ("w_shirt_buttondown_striped", "Top"),
    ("w_blouse_stand_collar", "Top"),
    ("w_top_white_longsleeve", "Top"),
    ("w_tshirt_white_crew", "Top"),
    ("w_tshirt_black_fitted", "Top"),
    # Women Outerwear
    ("w_blazer_suit_black", "Outerwear"),
    ("w_trench_coat_cream", "Outerwear"),
    ("w_cardigan_long_black", "Outerwear"),
    # Women Footwear
    ("w_sneakers_white_navy", "Footwear"),
    ("w_heels_pumps_black", "Footwear"),
    ("w_loafers_black", "Footwear"),
    ("w_sandals_wedge_black", "Footwear"),
    # Men Full Body
    ("m_thobe_white", "Full Body"),
    ("m_kurta_set_festive", "Full Body"),
    ("m_suit_navy_three_piece", "Full Body"),
    # Men Tops & T-Shirts
    ("m_kurta_lightblue", "Top"),
    ("m_guayabera_linen", "Top"),
    ("m_shirt_dress_grey", "Top"),
    ("m_shirt_relaxed_white", "Top"),
    ("m_sweater_shawl_knit", "Top"),
    ("m_polo_white", "Top"),
    ("m_tshirt_navy", "Top"),
    ("m_tshirt_white_crew", "Top"),
    ("m_tshirt_black_crew", "Top"),
    # Men Outerwear
    ("m_blazer_suit_charcoal", "Outerwear"),
    ("m_blazer_smart_lightblue", "Outerwear"),
    ("m_nehru_waistcoat_black", "Outerwear"),
    ("m_achkan_royal_blue", "Outerwear"),
    ("m_trench_coat_khaki", "Outerwear"),
    # Men Bottoms
    ("m_trousers_dress_charcoal", "Bottom"),
    ("m_pants_relaxed_olive", "Bottom"),
    ("m_chinos_beige", "Bottom"),
    ("m_pants_white_linen", "Bottom"),
    ("m_jeans_dark_indigo", "Bottom"),
    # Men Footwear
    ("m_shoes_derby_brown", "Footwear"),
    ("m_loafers_leather_brown", "Footwear"),
    ("m_boots_chelsea_brown", "Footwear"),
    ("m_sneakers_navy_white", "Footwear"),
]

# Warm up SegFormer and rembg once
print("Warming up SegFormer-b3 and rembg models...")
clothing_parser._load_model()
background_matting._get_session()
id2label = clothing_parser._id2label
print("SegFormer classes:", id2label)

HUMAN_LABELS = {
    "Face", "face", "Hair", "hair",
    "Left-arm", "left-arm", "Right-arm", "right-arm",
    "Left-leg", "left-leg", "Right-leg", "right-leg",
    "Hat", "hat", "Sunglasses", "sunglasses", "Bag", "bag", "bag, wallet",
    "headband, head covering, hair accessory", "glasses",
}
SHOE_LABELS = {"Left-shoe", "left-shoe", "Right-shoe", "right-shoe", "shoe", "sock"}
UPPER_LABELS = {
    "Upper-clothes", "upper-clothes",
    "shirt, blouse", "top, t-shirt, sweatshirt", "sweater",
    "cardigan", "jacket", "coat", "vest", "cape",
}
OUTERWEAR_ONLY_LABELS = {"cardigan", "jacket", "coat", "vest", "cape"}
INNER_TOP_LABELS = {"shirt, blouse", "top, t-shirt, sweatshirt", "sweater"}
DRESS_LABELS = {"Dress", "dress", "jumpsuit"}
BOTTOM_LABELS = {"Pants", "pants", "shorts", "Skirt", "skirt", "tights, stockings"}
SCARF_LABELS = {"Scarf", "scarf"}
BELT_LABELS = {"Belt", "belt"}

HUMAN_CIDS = {cid for cid, lbl in id2label.items() if lbl in HUMAN_LABELS}
SHOE_CIDS = {cid for cid, lbl in id2label.items() if lbl in SHOE_LABELS}
UPPER_CIDS = {cid for cid, lbl in id2label.items() if lbl in UPPER_LABELS}
OUTERWEAR_ONLY_CIDS = {cid for cid, lbl in id2label.items() if lbl in OUTERWEAR_ONLY_LABELS}
INNER_TOP_CIDS = {cid for cid, lbl in id2label.items() if lbl in INNER_TOP_LABELS}
DRESS_CIDS = {cid for cid, lbl in id2label.items() if lbl in DRESS_LABELS}
BOTTOM_CIDS = {cid for cid, lbl in id2label.items() if lbl in BOTTOM_LABELS}
SCARF_CIDS = {cid for cid, lbl in id2label.items() if lbl in SCARF_LABELS}
BELT_CIDS = {cid for cid, lbl in id2label.items() if lbl in BELT_LABELS}


def extract_clean_garment(oid: str, category: str, raw_bytes: bytes) -> bytes:
    """Returns 600x800 RGBA PNG bytes of the isolated, studio-grade clean-cut garment."""
    if category == "Footwear":
        matted = background_matting._rembg_remove(raw_bytes)
        if matted:
            card_bytes, _ = vision_image.ensure_transparent_vertical_card(
                matted, category="Footwear", canvas_w=600, canvas_h=800
            )
            return card_bytes
        card_bytes, _ = vision_image.ensure_transparent_vertical_card(
            raw_bytes, category="Footwear", canvas_w=600, canvas_h=800
        )
        return card_bytes

    pil_orig = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    W, H = pil_orig.size
    class_mask = clothing_parser._run_inference(pil_orig)

    # Determine target garment classes vs excluded classes
    if category == "Outerwear":
        ow_px = int(np.isin(class_mask, list(OUTERWEAR_ONLY_CIDS)).sum())
        if ow_px >= int(0.04 * W * H) and oid not in ("m_achkan_royal_blue", "m_nehru_waistcoat_black"):
            # Isolate ONLY the blazer / jacket / trench / cardigan and excise inner shirt/tee
            target_cids = set(OUTERWEAR_ONLY_CIDS)
            if oid in ("w_cardigan_long_black", "w_trench_coat_cream", "m_trench_coat_khaki"):
                target_cids |= DRESS_CIDS
            other_cids = INNER_TOP_CIDS | BOTTOM_CIDS | SHOE_CIDS | BELT_CIDS | (DRESS_CIDS - target_cids)
        elif oid in ("m_nehru_waistcoat_black", "m_achkan_royal_blue"):
            # Sleeveless waistcoat: run raw SegFormer without sleeve-absorption so shirt sleeves are excluded
            import torch
            import torch.nn.functional as F
            pil_small = clothing_parser._resize_for_inference(pil_orig)
            inputs = clothing_parser._processor(images=pil_small, return_tensors="pt")
            with torch.no_grad():
                logits = clothing_parser._model(**inputs).logits
            logits_up = F.interpolate(logits, size=(H, W), mode="bilinear", align_corners=False)
            raw_pred = logits_up.argmax(dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
            # Only keep vest/jacket/coat + collar/lapel/pocket/button subparts (NOT sleeve=32 or shirt=1!)
            sub_keep = {cid for cid, nm in id2label.items() if nm in ("collar", "lapel", "pocket", "buckle", "zipper")}
            class_mask = raw_pred
            target_cids = OUTERWEAR_ONLY_CIDS | sub_keep
            other_cids = INNER_TOP_CIDS | BOTTOM_CIDS | SHOE_CIDS | BELT_CIDS | {32}
        else:
            target_cids = set(UPPER_CIDS) | DRESS_CIDS
            other_cids = BOTTOM_CIDS | SHOE_CIDS | BELT_CIDS
    elif category == "Top":
        target_cids = set(UPPER_CIDS)
        upper_px = int(np.isin(class_mask, list(UPPER_CIDS)).sum())
        dress_px = int(np.isin(class_mask, list(DRESS_CIDS)).sum())
        if oid in ("w_tunic_mandarin_green", "m_kurta_lightblue") or upper_px < int(0.05 * W * H) or dress_px > upper_px * 0.35:
            target_cids |= DRESS_CIDS
        other_cids = BOTTOM_CIDS | SHOE_CIDS | BELT_CIDS | (DRESS_CIDS - target_cids)
    elif category == "Bottom":
        target_cids = set(BOTTOM_CIDS)
        bottom_px = int(np.isin(class_mask, list(BOTTOM_CIDS)).sum())
        if bottom_px < int(0.04 * W * H):
            target_cids |= DRESS_CIDS
        other_cids = UPPER_CIDS | SHOE_CIDS | SCARF_CIDS | BELT_CIDS | (DRESS_CIDS - target_cids)
    else:  # Full Body
        if oid in ("w_abaya_black", "w_kaftan_emerald", "m_thobe_white", "m_kurta_set_festive", "m_suit_navy_three_piece"):
            target_cids = UPPER_CIDS | DRESS_CIDS | SCARF_CIDS
            other_cids = BOTTOM_CIDS | SHOE_CIDS
        else:
            target_cids = UPPER_CIDS | DRESS_CIDS | BOTTOM_CIDS | SCARF_CIDS
            other_cids = SHOE_CIDS

    target_bin = np.isin(class_mask, list(target_cids))
    human_bin = np.isin(class_mask, list(HUMAN_CIDS))
    other_bin = np.isin(class_mask, list(other_cids))

    # Subtract dilated accessory/human-head/other-garment masks from raw target_bin
    human_dil = ndimage.binary_dilation(human_bin, iterations=2)
    other_dil = ndimage.binary_dilation(other_bin, iterations=3 if category in ("Top", "Outerwear") else 2)
    raw_garment = target_bin & (~human_dil) & (~other_dil)

    # Keep only significant connected components of raw_garment
    labeled, n_comp = ndimage.label(raw_garment)
    if n_comp > 1:
        sizes = ndimage.sum(raw_garment, labeled, range(1, n_comp + 1))
        max_sz = float(np.max(sizes))
        keep_ids = [i + 1 for i, sz in enumerate(sizes) if sz >= 0.12 * max_sz]
        raw_garment = np.isin(labeled, keep_ids)

    # Also run rembg to get sub-pixel anti-aliased outer silhouette
    matted_bytes = background_matting._rembg_remove(raw_bytes)
    if matted_bytes:
        matted_rgba = Image.open(io.BytesIO(matted_bytes)).convert("RGBA")
        if matted_rgba.size != (W, H):
            matted_rgba = matted_rgba.resize((W, H), Image.Resampling.LANCZOS)
        rembg_alpha = np.asarray(matted_rgba.split()[-1], dtype=np.float32) / 255.0
    else:
        rembg_alpha = np.ones((H, W), dtype=np.float32)

    # Only heal enclosed interior holes for w_saree_maroon (hand on front) and w_tshirt_white_crew (crossbody bag)
    if oid == "w_tshirt_white_crew":
        horiz_bridged = ndimage.binary_closing(raw_garment, structure=np.ones((5, int(0.22 * W)), dtype=bool))
        healed_garment = ndimage.binary_fill_holes(raw_garment | (horiz_bridged & (rembg_alpha > 0.5)))
    elif oid == "w_saree_maroon":
        healed_garment = ndimage.binary_fill_holes(raw_garment)
    else:
        # Fill only small interior holes (<= 500 px, e.g. buttons/prints), never bridging external side edges!
        filled_all = ndimage.binary_fill_holes(raw_garment)
        holes = filled_all & (~raw_garment)
        h_lbl, n_h = ndimage.label(holes)
        if n_h > 0:
            h_sizes = ndimage.sum(holes, h_lbl, range(1, n_h + 1))
            small_h = [i + 1 for i, sz in enumerate(h_sizes) if sz <= 500]
            healed_garment = raw_garment | np.isin(h_lbl, small_h)
        else:
            healed_garment = raw_garment

    # Smooth outer contour slightly without filling large open regions (e.g. between blazer lapels or trouser legs)
    k = max(3, min(11, int(round(min(H, W) * 0.004)) | 1))
    closed = ndimage.binary_closing(healed_garment, structure=np.ones((k, k), dtype=bool), iterations=1)
    # Keep significant connected components (including both halves of an open cardigan/jacket)
    c_lbl, n_c = ndimage.label(closed)
    if n_c > 1:
        c_sizes = ndimage.sum(closed, c_lbl, range(1, n_c + 1))
        max_csz = float(np.max(c_sizes))
        keep_c = [i + 1 for i, sz in enumerate(c_sizes) if sz >= 0.12 * max_csz]
        closed = np.isin(c_lbl, keep_c)
    clean_target = ndimage.gaussian_filter(closed.astype(np.float32), sigma=1.5) >= 0.5

    if oid in ("w_saree_maroon", "w_tshirt_white_crew"):
        hand_occlusion = clean_target & (~raw_garment)
        occ_core = ndimage.binary_erosion(hand_occlusion, iterations=2)
        if np.any(occ_core):
            occ_patch = ndimage.binary_dilation(occ_core, iterations=4) & clean_target
            valid_fabric = raw_garment & (~occ_patch)
            if np.any(valid_fabric):
                rgb_arr = np.asarray(pil_orig, dtype=np.float32).copy()
                _, (ny, nx) = ndimage.distance_transform_edt(
                    ~valid_fabric, sampling=(1.0, 3.0), return_indices=True
                )
                rgb_arr[occ_patch] = rgb_arr[ny[occ_patch], nx[occ_patch]]
                blurred_rgb = np.asarray(
                    Image.fromarray(np.clip(rgb_arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=2)),
                    dtype=np.float32,
                )
                patch_edge = occ_patch & (~ndimage.binary_erosion(occ_patch, iterations=3))
                rgb_arr[patch_edge] = blurred_rgb[patch_edge]
                pil_orig = Image.fromarray(np.clip(rgb_arr, 0, 255).astype(np.uint8), mode="RGB")

    # Smooth SegFormer mask boundary for clean anti-aliased garment cutout
    seg_u8 = (clean_target.astype(np.uint8) * 255)
    seg_smooth = np.asarray(
        Image.fromarray(seg_u8, mode="L").filter(ImageFilter.GaussianBlur(radius=1.5)),
        dtype=np.float32,
    ) / 255.0

    # Combine SegFormer garment mask with rembg anti-aliased edge (while keeping interior fabric 100% opaque)
    interior = ndimage.binary_erosion(clean_target, iterations=3)
    combined_alpha = np.minimum(seg_smooth, np.maximum(rembg_alpha, interior.astype(np.float32)))
    # Zero out anything outside the dilated SegFormer garment mask (strictly no head/limbs/other clothes!)
    strict_bound = ndimage.binary_dilation(clean_target, iterations=1)
    combined_alpha = np.where(strict_bound, combined_alpha, 0.0)
    alpha_u8 = np.clip(combined_alpha * 255.0, 0, 255).astype(np.uint8)

    rgba_out = pil_orig.convert("RGBA")
    rgba_out.putalpha(Image.fromarray(alpha_u8, mode="L"))
    rgba_out = background_matting.drop_disconnected_islands(rgba_out, min_area_ratio=0.05)

    buf = io.BytesIO()
    rgba_out.save(buf, format="PNG")

    # Fit tightly and center on a 600x800 studio 3:4 portrait card
    fitted_png_bytes, _ = vision_image._fit_crop_to_card(
        buf.getvalue(),
        crop_mime="image/png",
        canvas_w=600,
        canvas_h=800,
    )
    return fitted_png_bytes


if __name__ == "__main__":
    only_ids = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    for idx, (oid, cat) in enumerate(ITEMS_52, 1):
        if only_ids and oid not in only_ids:
            continue
        src_path = ASSETS_DIR / f"{oid}.jpg"
        raw_backup_path = RAW_BACKUP_DIR / f"{oid}.jpg"
        if not raw_backup_path.exists() and src_path.exists():
            shutil.copy2(src_path, raw_backup_path)

        source_file = raw_backup_path if raw_backup_path.exists() else src_path
        if not source_file.exists():
            print(f"[{idx:2d}/52] MISSING: {oid}")
            continue

        raw_bytes = source_file.read_bytes()
        cutout_png_bytes = extract_clean_garment(oid, cat, raw_bytes)

        # 1. Save transparent studio cutout PNG: {oid}_cutout.png
        cutout_path = ASSETS_DIR / f"{oid}_cutout.png"
        cutout_path.write_bytes(cutout_png_bytes)

        # 2. Also save clean studio white JPEG to {oid}.jpg (so .jpg is also clean-cut garment-only!)
        cutout_im = Image.open(io.BytesIO(cutout_png_bytes)).convert("RGBA")
        white_card = Image.new("RGB", cutout_im.size, (245, 245, 244))  # stone-100 card studio neutral
        white_card.paste(cutout_im, mask=cutout_im.split()[-1])
        white_card.save(src_path, format="JPEG", quality=92, optimize=True)

        print(f"[{idx:2d}/52] [OK] {oid:28s} ({cat:9s}) -> {cutout_path.name} ({len(cutout_png_bytes)//1024:3d} KB)", flush=True)

    print("All 52 onboarding items processed with GarmentVision!")
