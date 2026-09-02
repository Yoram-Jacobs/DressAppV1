import cv2
import numpy as np
import io
from PIL import Image

def extract_garment_mask(img: Image.Image) -> np.ndarray:
    """Extract binary mask of garment (255 for garment, 0 for background).
    
    Works for both RGBA cutouts and RGB photos with neutral/solid backgrounds.
    """
    has_alpha = (
        img.mode in ("RGBA", "LA")
        or (img.mode == "P" and "transparency" in img.info)
    )
    if has_alpha:
        img_rgba = img.convert("RGBA")
        alpha = np.array(img_rgba.split()[-1])
        # Check if alpha actually segments something
        coverage = np.mean(alpha > 30)
        if 0.02 < coverage < 0.95:
            # Alpha is a valid segmentation mask
            return (alpha > 30).astype(np.uint8) * 255

    # RGB fallback: segment by color contrast against corners/borders
    rgb = np.array(img.convert("RGB"))
    h, w = rgb.shape[:2]
    if h < 10 or w < 10:
        return np.ones((h, w), dtype=np.uint8) * 255

    # Sample borders to determine background color
    border_pixels = np.concatenate([
        rgb[0, :],         # top row
        rgb[h - 1, :],     # bottom row
        rgb[:, 0],         # left col
        rgb[:, w - 1],     # right col
    ], axis=0).astype(np.float32)

    bg_color = np.median(border_pixels, axis=0)

    # Calculate Euclidean color distance from background
    diff = rgb.astype(np.float32) - bg_color
    dist = np.sqrt(np.sum(diff ** 2, axis=2))

    # Threshold: garment is pixels with distance > 22 from background
    mask = (dist > 22).astype(np.uint8) * 255

    # Morphological cleanup (close holes, remove salt noise)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    # Filter out tiny connected components if any
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    if num_labels > 1:
        # Keep components with area > 1% of total area
        min_area = (h * w) * 0.01
        clean_mask = np.zeros_like(mask)
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] >= min_area:
                clean_mask[labels == i] = 255
        if np.any(clean_mask):
            mask = clean_mask

    return mask


def deskew_and_extend_garment(img: Image.Image, canvas_w: int = 900, canvas_h: int = 1200) -> Image.Image:
    """Robustly isolate garment, rotate upright, crop tight, extend to 90% canvas, and center."""
    mask = extract_garment_mask(img)
    pts = np.column_stack(np.where(mask > 0))
    if len(pts) < 100:
        # Fallback if no garment detected
        return img

    # Make RGBA with garment mask as alpha
    rgba = img.convert("RGBA")
    rgba.putalpha(Image.fromarray(mask, mode="L"))

    # Determine slant angle using major axis of garment points
    pts_xy = np.column_stack((pts[:, 1], pts[:, 0])).astype(np.float32)
    [vx, vy, x0, y0] = cv2.fitLine(pts_xy, cv2.DIST_L2, 0, 0.01, 0.01)
    line_angle = float(np.degrees(np.arctan2(vy[0], vx[0])))
    if line_angle < 0:
        line_angle += 180

    # Align major axis with vertical (90 deg)
    rot_needed = line_angle - 90.0
    while rot_needed > 45:
        rot_needed -= 90
    while rot_needed < -45:
        rot_needed += 90

    if abs(rot_needed) > 2.0:
        rgba = rgba.rotate(rot_needed, resample=Image.BICUBIC, expand=True)

    # Crop tightly to garment
    bbox = rgba.getbbox()
    if bbox and (bbox[2] - bbox[0] > 4) and (bbox[3] - bbox[1] > 4):
        rgba = rgba.crop(bbox)

    # Scale to 90% of canvas
    gw, gh = rgba.size
    scale = min(canvas_w * 0.90 / float(gw), canvas_h * 0.90 / float(gh))
    nw = max(1, int(round(gw * scale)))
    nh = max(1, int(round(gh * scale)))
    scaled = rgba.resize((nw, nh), resample=Image.LANCZOS)

    # Center on canvas
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    ox = (canvas_w - nw) // 2
    oy = (canvas_h - nh) // 2
    canvas.paste(scaled, (ox, oy), mask=scaled)

    return canvas

# Test 1: Tilted RGBA Cutout
tilted_rgba = Image.new("RGBA", (100, 400), (0, 0, 255, 255))
canvas_temp = Image.new("RGBA", (600, 600), (0, 0, 0, 0))
canvas_temp.paste(tilted_rgba, (250, 100))
tilted_test1 = canvas_temp.rotate(35, expand=True)

out1 = deskew_and_extend_garment(tilted_test1)
b1 = out1.getbbox()
w1 = b1[2] - b1[0]
h1 = b1[3] - b1[1]
print(f"Test 1 (RGBA cutout): {w1}x{h1} on 900x1200 (height: {h1/1200:.1%})")

# Test 2: Tilted RGB Photo with solid light background
tilted_rgb = Image.new("RGB", (600, 600), (245, 242, 235))
shirt_rgb = Image.new("RGB", (120, 350), (20, 30, 60))
tilted_rgb.paste(shirt_rgb, (240, 125))
tilted_test2 = tilted_rgb.rotate(30, expand=True, fillcolor=(245, 242, 235))

out2 = deskew_and_extend_garment(tilted_test2)
b2 = out2.getbbox()
w2 = b2[2] - b2[0]
h2 = b2[3] - b2[1]
print(f"Test 2 (RGB photo with bg): {w2}x{h2} on 900x1200 (height: {h2/1200:.1%})")

