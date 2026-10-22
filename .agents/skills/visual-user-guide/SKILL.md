---
name: visual-user-guide
description: Build visual infographic user guides and mobile screen-recording walkthroughs for DressApp. Use when creating Getting Started guides, feature walkthrough clips, mobile screen recordings, or step-by-step Canva/infographic posters.
---

# DressApp Visual Infographic User Guide Skill

Builds realistic mobile screen-recording walkthroughs (`.mp4`, `.webm`, `.webp`, `.gif`), keyframe screen carousels, 6-step visual infographic posters, and editable Canva designs using authentic DressApp screens (`C:\DressApp_AG\apps\web\build`).

Reference scripts live in [`scripts/`](scripts/):
- [`scripts/record_guide.js`](scripts/record_guide.js) — Playwright mobile recorder with deterministic local mock API server, touch-tap ring, step pill, and smooth vertical scroll helper.
- [`scripts/encode_video.py`](scripts/encode_video.py) — Full-screen frame normalizer, 1.0x real-time MP4/WebP/GIF encoder, and transition contact-sheet verifier (run with `C:\DressApp_AG\backend\venv\Scripts\python.exe`).
- [`scripts/build_infographic_sheet.py`](scripts/build_infographic_sheet.py) — 6-step visual infographic poster generator (`2400×1185` PNG).

## Core Recording Invariants

1. **Full-Screen Format (`1x` Screencast Lock)**
   - Configure `browser.newContext` with matching dimensions: `viewport: { width: 390, height: 844 }`, `deviceScaleFactor: 1`, `recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } }`.
   - Keep the active recording loop free of `page.screenshot()` calls. Mid-recording `page.screenshot()` calls trigger CDP scale changes that make Playwright's video jump between a top-left quarter-screen view and full screen. Extract step keyframe PNGs from the recorded video frames in `encode_video.py`.
   - Always pass frames through `normalize_to_fullscreen(frame)` in `encode_video.py` and inspect `debug_transitions_fixed.jpg` before publishing.

2. **Fixed Viewpoint & Fixed Frame Size**
   - Keep the mobile screen viewpoint (`390×844`) and original DressApp component proportions unchanged throughout the clip.
   - When showing before/after background removal inside `[data-testid="add-item-card-photo"]`, use identical dimensions (`1024×1365`), identical garment placement, `crop_mime: 'image/jpeg'`, and `object-fit: cover !important; width: 100% !important; height: 100% !important;` so the garment stays locked in the exact same pixel position and scale when the background vanishes.
   - In simulated camera viewfinder overlays (`#guide-camera-overlay`), keep the overhead garment photo stationary (`transform: none`) and animate only the yellow autofocus box (`#cam-focus-box`) and shutter flash (`#cam-flash`).

3. **Natural Vertical Scrolling & Unhurried Pace**
   - Preserve the authentic DressApp page layout and vertical scrolling. Scroll smoothly between sections using `window.__slowScrollBy(deltaY, 900)` (`requestAnimationFrame` ease-in-out).
   - Give viewers time to read and follow each step:
     - Hold `2.0s–2.6s` before each tap.
     - Use a slow `1.1s` red touch-tap pulse (`.guide-tap-ring`) on interactive targets and hold `0.8s–1.3s` after the tap.
     - Hold `2.4s` on each stage of background removal (raw photo scan → isolated cutout scan).
     - Hold `3.5s` on auto-filled analysis results and `3.5s` on the final destination screen.
   - Encode output at true `1.0x` real-time speed (`out_fps = src_fps`, ~25 FPS).

## Workflow Steps

1. **Prepare Garment & Cutout Assets**
   - Composite or generate the target garment photo (`1024×1365`) with the official DressApp logo (`C:\DressApp_AG\apps\web\public\dressapp-logo.png`) and generate a matching studio white-background cutout (`1024×1365`) with identical garment coordinates.
   - Completion criterion: Both before and after images have identical pixel dimensions and garment bounding boxes.

2. **Record the Mobile Walkthrough (`record_guide.js`)**
   - Serve `C:\DressApp_AG\apps\web\build` on a local Node HTTP server with deterministic `/api/v1/*` routes (including streaming NDJSON for `/api/v1/closet/analyze` with `detect`, `matte`, `item`, and `done` frames).
   - Record the screenplay in Playwright at `390×844` (`deviceScaleFactor: 1`) without mid-recording `page.screenshot()` calls.
   - Completion criterion: `capture_meta.json` and the raw `.webm` file are written with zero errors.

3. **Encode Full-Screen Video, Keyframes & Infographic (`encode_video.py` & `build_infographic_sheet.py`)**
   - Run `C:\DressApp_AG\backend\venv\Scripts\python.exe encode_video.py` to normalize frames, extract `step1_*.png` through `step6_*.png`, encode `.mp4`, `.webp`, and `.gif`, and generate `debug_transitions_fixed.jpg`.
   - Visually inspect `debug_transitions_fixed.jpg` with `read_file` to verify 100% full-screen frames and zero quarter-screen jumps.
   - Run `C:\DressApp_AG\backend\venv\Scripts\python.exe build_infographic_sheet.py` to build the 6-step visual infographic poster and verify it with `read_file`.
   - Copy all outputs to both the conversation artifact directory and `C:\DressApp_AG\getting-started\`.
   - Completion criterion: `debug_transitions_fixed.jpg` shows 100% full-screen frames across all transitions, and all assets exist in `C:\DressApp_AG\getting-started\`.

4. **Create Editable Canva Guide & Artifact**
   - Call Canva MCP `create-design` with a structured 6-step brief matching the guide and poll `get-create-design-async-job` until completed.
   - Present the embedded `.webp` recording, `.mp4`/`.gif` links, 6-step infographic poster, step carousel, and Canva links in a user-facing artifact.
   - Completion criterion: Artifact is written and Canva design link is included in the final response.
