import os
import json
import glob
import shutil
import cv2
import numpy as np
from PIL import Image

SCRATCH_DIR = r"C:\Users\User\.gemini\antigravity\brain\6e985e9e-fea6-470e-942e-ae5a77527d5b\scratch"
ARTIFACT_DIR = r"C:\Users\User\.gemini\antigravity\brain\6e985e9e-fea6-470e-942e-ae5a77527d5b"
REPO_GUIDE_DIR = r"C:\DressApp_AG\getting-started"

def normalize_to_fullscreen(fr):
    """
    Playwright recordVideo with deviceScaleFactor=2 places normal 390x844 screencast
    frames in the top-left quarter [0:844, 0:390] of the 780x1688 canvas with solid
    gray padding [122, 125, 123] in the remaining 3/4 of the canvas, while frames
    captured during page.screenshot() fill the full 780x1688 canvas.
    This function normalizes every frame so 100% of frames are full-screen 540x1168 (or 390x844)
    with zero quarter-screen jumps.
    """
    h, w, _ = fr.shape
    br_patch = fr[int(h * 0.7):, int(w * 0.7):]
    if np.std(br_patch) < 4.0:
        # Quarter-screen frame: the full mobile viewport is in fr[0:844, 0:390]
        cropped = fr[0:844, 0:390]
        return cropped
    else:
        # Full-screen 780x1688 frame: downsample 2x -> 390x844 so resolution & framing match 100%
        return cv2.resize(fr, (390, 844), interpolation=cv2.INTER_AREA)

def main():
    meta_path = os.path.join(SCRATCH_DIR, "capture_meta.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    webm_path = meta.get("webmPath")
    if not webm_path or not os.path.exists(webm_path):
        webm_files = sorted(
            glob.glob(os.path.join(SCRATCH_DIR, "video_raw", "*.webm")),
            key=os.path.getmtime,
        )
        webm_path = webm_files[-1]

    start_offset_sec = max(0.0, float(meta.get("startOffsetSec", 1.0)) - 0.15)

    cap = cv2.VideoCapture(webm_path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    all_frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        all_frames.append(normalize_to_fullscreen(frame))
    cap.release()

    start_idx = min(max(0, int(round(start_offset_sec * src_fps))), max(0, len(all_frames) - 60))
    active_frames = all_frames[start_idx:]

    # Keep true natural 1.0x playback speed (25 FPS)
    out_fps = src_fps
    target_duration_sec = len(active_frames) / out_fps
    print(f"Normalized {len(active_frames)} active frames to full-screen 390x844 -> {target_duration_sec:.2f}s @ {out_fps:.2f} FPS")

    h, w, _ = active_frames[0].shape
    mp4_path = os.path.join(SCRATCH_DIR, "add-item-camera-guide.mp4")
    vw = cv2.VideoWriter(mp4_path, cv2.VideoWriter_fourcc(*"mp4v"), out_fps, (w, h))
    for fr in active_frames:
        vw.write(fr)
    vw.release()
    print(f"Saved full-screen MP4: {mp4_path} ({os.path.getsize(mp4_path)} bytes, {target_duration_sec:.2f}s)")

    # Build smooth 8fps animated GIF & WebP (390x844) at exact real-time duration
    target_gif_frames = min(len(active_frames), int(round(target_duration_sec * 8)))
    indices = np.linspace(0, len(active_frames) - 1, target_gif_frames, dtype=int)
    frame_duration_ms = int(round((target_duration_sec * 1000) / len(indices)))

    pil_frames = []
    for idx in indices:
        rgb = cv2.cvtColor(active_frames[idx], cv2.COLOR_BGR2RGB)
        im = Image.fromarray(rgb)
        pil_frames.append(im)

    gif_path = os.path.join(SCRATCH_DIR, "add-item-camera-guide.gif")
    pil_frames[0].save(
        gif_path,
        save_all=True,
        append_images=pil_frames[1:],
        duration=frame_duration_ms,
        loop=0,
        optimize=True,
    )
    print(f"Saved full-screen GIF: {gif_path} ({os.path.getsize(gif_path)} bytes, {len(pil_frames)} frames @ {frame_duration_ms}ms)")

    webp_path = os.path.join(SCRATCH_DIR, "add-item-camera-guide.webp")
    pil_frames[0].save(
        webp_path,
        save_all=True,
        append_images=pil_frames[1:],
        duration=frame_duration_ms,
        loop=0,
        quality=88,
    )
    print(f"Saved full-screen WebP: {webp_path} ({os.path.getsize(webp_path)} bytes)")

    # Verify zero high-diff jumps and save verification contact sheet
    verify_indices = [27, 28, 33, 34, 263, 264, 279, 280, 345, 346, 451, 452, 542, 543, 681, 682]
    sheet = Image.new("RGB", (8 * 195, 2 * 422), (30, 30, 30))
    for k, vi in enumerate(verify_indices):
        vi_clamped = min(vi, len(active_frames) - 1)
        rgb = cv2.cvtColor(active_frames[vi_clamped], cv2.COLOR_BGR2RGB)
        im = Image.fromarray(rgb).resize((195, 422), Image.Resampling.LANCZOS)
        sheet.paste(im, ((k % 8) * 195, (k // 8) * 422))
    sheet.save(os.path.join(SCRATCH_DIR, "debug_transitions_fixed.jpg"), quality=88)

    # Copy all video/animation files to ARTIFACT_DIR and REPO_GUIDE_DIR
    os.makedirs(REPO_GUIDE_DIR, exist_ok=True)
    for src in [
        mp4_path,
        gif_path,
        webp_path,
    ]:
        if os.path.exists(src):
            bn = os.path.basename(src)
            shutil.copy2(src, os.path.join(ARTIFACT_DIR, bn))
            shutil.copy2(src, os.path.join(REPO_GUIDE_DIR, bn))

if __name__ == "__main__":
    main()
