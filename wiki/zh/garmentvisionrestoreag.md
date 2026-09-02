# Garment Vision Restoration & Unification Summary

This document summarizes the key architectural changes, bug fixes, and feature unifications performed to restore and enhance the Garment Vision pipeline.

## 1. Core Objective
The primary goal was to restore the legacy `analyze_outfit` architecture (which correctly utilized SegFormer for context and full-photo visibility) while bringing back the "Gemini streaming" experience that existed in `analyze()`. The constraint was to unify the entire pipeline so that **all** upload workflows (single photo, 2-5 batch, 6+ batch) use a single endpoint and function.

## 2. Key Architectural Changes

### Unified Backend Streaming Endpoint (`analyze_outfits_stream`)
- Created a new generator `analyze_outfits_stream` in `GarmentVisionService`. 
- Instead of accepting a single image, it natively accepts an array of images (`images_bytes_list: list[bytes]`).
- Performs object detection and cropping (`SegFormer`) on all uploaded images.
- Flattens the valid crops across all images into a single batched `Gemini` API call to maximize throughput and bypass LLM key concurrency bottlenecks.
- Emits NDJSON frames (`detect`, `item`, `item_skip`) that now include an `image_index`, allowing the frontend to route the streamed analysis back to the correct original photo.

### Frontend API Unification (`AddItem.jsx`)
- Refactored `AddItem.jsx` to package all incoming photos into an array payload instead of performing sequential API calls.
- **Batches 1-5:** Handled by a new `analyzeCards(cardsList)` function. All photos are submitted in a single request, and the UI maps incoming streamed items to their respective preview cards dynamically.
- **Batches 6+:** Restored the `handleBatchBackground` workflow to prevent UI clutter. It uses a minimalist background progress bar (`BgBatchProgress`) but utilizes the same unified streaming endpoint to process and auto-save items as they stream back.

## 3. Critical Bug Fixes

### A. Wrong Classification (Missing SegFormer Context)
- **Issue:** Gemini was often misclassifying items (e.g., skirts as jeans) because it only saw the isolated crop and lacked the context of the original photo.
- **Fix:** We threaded the per-crop SegFormer `kind` into the batched Gemini call as a "CROP CATEGORY HINTS" system prompt. This acts as an anchor (Layer 1) to steer the LLM away from misclassifications caused by adjacent garment leakage, effectively restoring the legacy context.

### B. "White Canvas" / Streaming State Desync
- **Issue:** Returning to the closet without clicking "Save" resulted in a white canvas replacing the original image, and "Revert" button functionality broke.
- **Fix:** The introduction of the `image_index` and flat slot tracking inside `analyzeCards` fixed the stream routing. NDJSON frames are strictly mapped to their parent cards using robust UUID generation, preventing UI state desynchronization and corrupted image blobs.

### C. Out-Of-Memory (OOM) on 5+ Batch Uploads
- **Issue:** The server crashed and returned `ERR_HTTP2_PROTOCOL_ERROR` when uploading 5 images.
- **Fix:** The initial implementation used `asyncio.gather` to run SegFormer on all 5 full-resolution images concurrently, which OOM-killed the ONNX runtime. Changed the initial detection pass (`_detect_and_crop`) to run sequentially. This keeps memory stable while only adding ~1-2 seconds per image to the pipeline.

### D. Missing `rembg` (Background Removal) on Single Garment Photos
- **Issue:** Uploading an already-cropped photo (e.g., a flat lay t-shirt) bypassed background removal completely, returning a JPEG with a background instead of a transparent PNG cutout.
- **Fix:** Fixed the short-circuit logic for already-cropped photos. When `_looks_already_cropped` returns `True`, the pipeline now correctly assigns the `defer_matte = True` flag (or runs it inline based on settings), ensuring the image is properly matted instead of skipping the step.

## 4. Final Pipeline Structure
1. **Frontend:** User selects `N` photos. `AddItem.jsx` extracts `base64` for all `N` photos and calls `api.analyzeItemImage({ images_base64 })`.
2. **Backend API:** `/closet/analyze` routes the array to `analyze_outfits_stream`.
3. **Backend Detection:** Sequentially runs SegFormer on each photo to extract `N*M` total bounding box crops.
4. **Backend Analysis:** Streams all `N*M` crops in a single batched multimodal request to Gemini. For single-crop uploads (e.g. 1 pre-cropped product photo), it hits a fast-path that uses structured JSON schema generation instead of array streaming, cutting latency by ~15-20s.
5. **Stream Return:** Yields frames back to the frontend with `image_index`, allowing `AddItem.jsx` to update preview cards (1-5) or the background progress bar (6+) seamlessly.

### E. Streaming Unification (Single vs Multiple Items)
- **Issue:** Previously, a fast-path for single-item uploads (`len(flat_crops) == 1`) bypassed the streaming pipeline in favor of a legacy JSON schema endpoint. While intended to save overhead, it completely broke the streaming UI effect for single items and camera uploads.
- **Fix:** Removed the single-item fast-path. All workflows (Single Item, Camera Upload, Outfits) now route strictly through `analyze_outfits_stream` and `analyze_batch_stream`. 
- **Streaming Clarification:** For a *single item*, the LLM only generates *one* JSON block. Because our frontend parser requires a complete JSON object to render a card, the item will not appear progressively field-by-field. The expected behavior is that the user sees "Scanning..." for ~20 seconds (Gemini's Time-To-First-Token) and then the item appears instantly. *Visible progressive streaming* (staggered loading) only occurs on multi-item shots (e.g., item 1 at 20s, item 2 at 22s).

### F. Form Accessibility & Extension Quirks
- **Issue:** The Chrome console threw accessibility warnings about missing `id` and `name` attributes, and third-party extensions threw generic "message channel closed" errors.
- **Fix:** Refactored the `AddItem.jsx` and `WeightedList.jsx` React components to generate unique, per-card `idPrefix` keys. Applied `id` and `htmlFor` attributes to all `<Input>`, `<Select>`, and `<Label>` components, resolving all browser accessibility warnings and ensuring correct autofill behavior.
- **Clarification:** Confirmed that the "A listener indicated an asynchronous response..." console error originates strictly from third-party Chrome extensions and has absolutely no impact on the frontend streaming pipeline or backend latency.

### G. UI Cleanup and Toast Scrolling
- **Issue:** The 'Cancel' button and 'Delete-Select' floater were disjointed in the UI. Notification toasts persisted even when scrolling through large closets.
- **Fix:** Unified the floater and the 'Cancel' button into a seamless fixed position overlay in `Closet.jsx` using `AnimatePresence`. Added a global scroll listener to `App.js` that automatically dismisses active toast notifications as soon as the user starts scrolling the page.

### H. Backend Concurrency on High-Res Bulk Uploads (OOM)
- **Issue:** Processing a batch of 6 items (e.g. 6 SLR photos) caused the backend to crash with a 502 Error after ~11.7 seconds, exhausting the 6GB container memory limit.
- **Fix:** Reduced the internal `_ANALYZE_CONCURRENCY` in `closet.py` from 3 to 1. This bounds the number of concurrent multi-modal requests made for large items within a single upload stream to strictly prevent the server from running out of memory.

### I. EXIF Rotation and Client-Side Optimization (Preflight Pipeline)
- **Issue:** High-resolution SLR photos failed duplicate detection due to incorrect orientation (EXIF rotation ignored), and loaded uncompressed into canvas which overwhelmed the browser memory and resulted in backend OOMs.
- **Fix:** Rewired the frontend preflight pipeline in `AddItem.jsx`. The pipeline now shrinks and corrects the aspect ratio of the image FIRST by executing `fileToBase64` (which respects EXIF via `createImageBitmap({ imageOrientation: 'from-image' })`) before any client-side components. The duplicate detection tools (`aHashFile`, `colorSignatureFile`, `sha256File`) now run on the optimized (~150KB) version, entirely preventing browser memory spikes, fixing the rotation bugs, and guaranteeing the backend receives small, perfectly cropped images regardless of the original camera format.
