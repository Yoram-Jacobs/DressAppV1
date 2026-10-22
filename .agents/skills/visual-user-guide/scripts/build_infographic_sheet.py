import os
import shutil
from PIL import Image, ImageDraw, ImageFont

SCRATCH_DIR = r"C:\Users\User\.gemini\antigravity\brain\6e985e9e-fea6-470e-942e-ae5a77527d5b\scratch"
ARTIFACT_DIR = r"C:\Users\User\.gemini\antigravity\brain\6e985e9e-fea6-470e-942e-ae5a77527d5b"
REPO_GUIDE_DIR = r"C:\DressApp_AG\getting-started"
LOGO_PATH = r"C:\DressApp_AG\apps\web\public\dressapp-logo.png"

def get_font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

def round_corners(im, rad):
    circle = Image.new("L", (rad * 2, rad * 2), 0)
    draw = ImageDraw.Draw(circle)
    draw.ellipse((0, 0, rad * 2 - 1, rad * 2 - 1), fill=255)
    alpha = Image.new("L", im.size, 255)
    w, h = im.size
    alpha.paste(circle.crop((0, 0, rad, rad)), (0, 0))
    alpha.paste(circle.crop((0, rad, rad, rad * 2)), (0, h - rad))
    alpha.paste(circle.crop((rad, 0, rad * 2, rad)), (w - rad, 0))
    alpha.paste(circle.crop((rad, rad, rad * 2, rad * 2)), (w - rad, h - rad))
    im = im.convert("RGBA")
    im.putalpha(alpha)
    return im

def main():
    W, H = 2400, 1185
    bg = Image.new("RGBA", (W, H), (247, 243, 236, 255))  # DressApp warm beige
    draw = ImageDraw.Draw(bg)

    # Top header bar (DressApp dark emerald)
    draw.rectangle([0, 0, W, 165], fill=(31, 92, 69, 255))

    if os.path.exists(LOGO_PATH):
        logo = Image.open(LOGO_PATH).convert("RGBA").resize((96, 96), Image.Resampling.LANCZOS)
        bg.paste(logo, (60, 34), logo)

    f_title = get_font(48, bold=True)
    f_sub = get_font(24, bold=False)
    f_badge = get_font(20, bold=True)
    f_step_num = get_font(22, bold=True)
    f_step_title = get_font(22, bold=True)
    f_step_desc = get_font(18, bold=False)

    draw.text((178, 38), "DressApp · Getting Started Visual Guide", fill=(255, 255, 255, 255), font=f_title)
    draw.text(
        (178, 102),
        "Single Garment Camera Upload: From Flat-Lay Photo on a White Sheet to Your Digital Closet in Seconds",
        fill=(215, 238, 228, 255),
        font=f_sub,
    )

    # Duration pill on top right
    draw.rounded_rectangle([W - 360, 52, W - 60, 114], radius=31, fill=(22, 68, 51, 255), outline=(140, 195, 170, 255), width=2)
    draw.text((W - 332, 68), "Step-by-Step Mobile Flow", fill=(255, 255, 255, 255), font=f_badge)

    steps = [
        (
            "1",
            "Open Camera Upload",
            "On Add Item, select Camera & Upload and tap 'Take photo'.",
            os.path.join(SCRATCH_DIR, "step1_add_item.png"),
        ),
        (
            "2",
            "Snap on White Sheet",
            "Lay the red DressApp T-shirt flat on a white sheet on the floor.",
            os.path.join(SCRATCH_DIR, "step2_camera_shot.png"),
        ),
        (
            "3",
            "AI Background Removal",
            "The Eyes isolate the garment and remove the white sheet background.",
            os.path.join(SCRATCH_DIR, "step3_bg_removal_after.png"),
        ),
        (
            "4",
            "Review Auto-Fill",
            "Category, Brand (DressApp), Size, and Colors populate automatically.",
            os.path.join(SCRATCH_DIR, "step4_analysis_results.png"),
        ),
        (
            "5",
            "Tap Save",
            "Confirm your item details and tap the green Save button.",
            os.path.join(SCRATCH_DIR, "step5_save_tap.png"),
        ),
        (
            "6",
            "Ready in Your Closet",
            "Your new Red DressApp T-Shirt card is live in My Closet!",
            os.path.join(SCRATCH_DIR, "step6_closet_card.png"),
        ),
    ]

    margin_x = 55
    gap_x = 28
    card_w = (W - 2 * margin_x - 5 * gap_x) // 6  # ~358px
    phone_w = card_w - 24
    phone_h = int(round(phone_w * (844 / 390)))  # ~722px

    top_y = 210
    for i, (num, title, desc, img_path) in enumerate(steps):
        cx = margin_x + i * (card_w + gap_x)

        # Card container
        draw.rounded_rectangle(
            [cx, top_y, cx + card_w, H - 55],
            radius=24,
            fill=(255, 255, 255, 255),
            outline=(224, 218, 208, 255),
            width=2,
        )

        # Step badge + title header
        badge_r = 22
        bx = cx + 22
        by = top_y + 22
        draw.ellipse([bx, by, bx + badge_r * 2, by + badge_r * 2], fill=(31, 92, 69, 255))
        draw.text((bx + 15, by + 8), num, fill=(255, 255, 255, 255), font=f_step_num)
        draw.text((bx + 56, by + 8), title, fill=(24, 34, 30, 255), font=f_step_title)

        # Wrap description text (max 2 lines)
        words = desc.split()
        lines = []
        cur = ""
        for w_word in words:
            test = (cur + " " + w_word).strip()
            if draw.textlength(test, font=f_step_desc) <= card_w - 40:
                cur = test
            else:
                lines.append(cur)
                cur = w_word
        if cur:
            lines.append(cur)
        for li, line in enumerate(lines[:3]):
            draw.text((cx + 22, top_y + 78 + li * 25), line, fill=(95, 105, 100, 255), font=f_step_desc)

        # Phone bezel around screenshot
        px = cx + 12
        py = top_y + 168
        draw.rounded_rectangle(
            [px - 6, py - 6, px + phone_w + 6, py + phone_h + 6],
            radius=32,
            fill=(20, 24, 28, 255),
        )
        if os.path.exists(img_path):
            scr = Image.open(img_path).convert("RGBA").resize((phone_w, phone_h), Image.Resampling.LANCZOS)
            scr_round = round_corners(scr, 26)
            bg.paste(scr_round, (px, py), scr_round)

        # Notch pill at top of phone screen
        notch_w = 76
        draw.rounded_rectangle(
            [px + (phone_w - notch_w) // 2, py + 8, px + (phone_w + notch_w) // 2, py + 22],
            radius=7,
            fill=(15, 18, 22, 255),
        )

    out_png = os.path.join(SCRATCH_DIR, "dressapp-camera-upload-infographic.png")
    bg.convert("RGB").save(out_png, "PNG", optimize=True)
    print("Saved Infographic PNG:", out_png)
    shutil.copy2(out_png, os.path.join(ARTIFACT_DIR, "dressapp-camera-upload-infographic.png"))
    shutil.copy2(out_png, os.path.join(REPO_GUIDE_DIR, "dressapp-camera-upload-infographic.png"))

if __name__ == "__main__":
    main()
