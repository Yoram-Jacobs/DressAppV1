# Garment Vision Restore: Debugging & Bug Fix Summary

This document summarizes the recent debugging session to restore and refine the Garment Vision pipeline, specifically resolving issues with matting drops, regressions with shoes, and the persistent "white window" and under-detected items phenomena.

## 1. Crash on Palette / Grayscale Images (Patch 12o)
**Issue:** Certain image uploads (like `"P"` mode palettes or `"LA"` grayscale images) were failing the matting process and bypassing SegFormer's `parse_garments`. 
**Root Cause:** The `_solid_alpha_coverage` helper in `garment_vision.py` strictly expected an `"RGBA"` image when parsing the alpha channel. It crashed when attempting to slice the 4th channel on non-RGBA images.
**Fix:** Added a defensive check to `_solid_alpha_coverage` that explicitly converts the image (`img = img.convert("RGBA")`) before extracting the alpha mask.

## 2. The Missing Partner Shoe Regression (Patch 12p)
**Issue:** When uploading a pair of shoes, the system correctly detected both shoes initially, but one shoe was missing from the final cutout card.
**Root Cause:** A recently introduced cleanup step (`_postprocess_mask` in `clothing_parser.py`) was designed to remove noise by forcing the mask to **keep only the largest connected component**. Since a pair of shoes physically represents two disconnected blobs in the image, the smaller shoe was being deliberately wiped out by this noise-reduction logic.
**Fix:** Updated `_postprocess_mask` to accept a `keep_largest` toggle (defaulting to True). Updated `parse_garments` to specifically pass `keep_largest=False` when processing the `"Shoes"` category, allowing both shoe blobs to survive the pipeline.

## 3. The "White Window", Face Leaking, and Under-Detected Items (Patches 12q & 12r)
**Issue:** Items uploaded via the single-pass pipeline (which defers matting to a background task) were suffering from multiple cascading failures:
1. Small items were being "under-detected" and silently dropped.
2. The final cutout cards often featured a solid white background (the "white window").
3. Faces and limbs were still leaking into the garment crops.

**Root Causes:**
All three issues stemmed from applying matting safeguards originally designed for tight, zoomed-in crops to the **900x1200 padded white canvas** used by the background task (`_run_background_matte` in `closet.py`):
* **Under-detection:** The background task used a phantom guard that drops any item covering `< 5%` of the image area. On a 900x1200 canvas, 5% is over 54,000 pixels. Small items and accessories naturally failed this threshold and were thrown away.
* **White Window & Face Leaking:** The `apply_alpha_intersection` safety check requires the SegFormer mask to cover at least `40%` of the image, otherwise it bails out. Because garments on a 900x1200 canvas are usually `< 40%` of the area, the intersection step repeatedly bailed out, keeping the raw `rembg` output. Furthermore, `closet.py` was failing to pass the `human_mask` to the intersection, completely bypassing the skin-subtraction logic.
* **The Final Rejection (CLIP Guard):** Even when `rembg` produced a flawless cutout of the garment, the CLIP faithfulness guard compared the new transparent PNG against the original white-canvas JPEG. During conversion for CLIP, transparent pixels become black (0, 0, 0). CLIP saw a massive color shift from a white background to a black background, dropped the cosine similarity score below `0.85`, and **rejected the valid cutout**, forcing the UI to display the original un-matted JPEG (which still had the white background and the face/arms).

**Fixes:**
1. **Removed Phantom Guard (Patch 12q):** Removed the 5% `_PHANTOM_DROP_PCT` guard from `_run_background_matte` completely, as it acts as an absolute-pixel floor on padded canvases.
2. **Canvas-Aware Intersection (Patch 12q):** Added an `is_padded_canvas` bypass flag to `apply_alpha_intersection` in `clothing_parser.py` to gracefully ignore the 40% coverage threshold when processing background tasks.
3. **Restored Skin Subtraction (Patch 12q):** Updated `_pick_segformer_mask_for_category` to return and pipe the `human_mask` down into `apply_alpha_intersection` so faces and limbs are properly excluded.
4. **Advisory CLIP Guard (Patch 12r):** Modified `background_matting.py` so the CLIP faithfulness guard is purely advisory. Valid cutouts are no longer rejected simply because of white-to-transparent background conversions tricking the cosine similarity score.
