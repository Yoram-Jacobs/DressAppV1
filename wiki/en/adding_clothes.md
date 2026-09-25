# Ingesting & Adding Clothes

Digitize your physical wardrobe in seconds with multi-modal AI scanning, smart background removal, and automatic image completion.

## Overview
Ingest clothes using live camera snaps, multi-image gallery uploads, Digital Product Passports (DPP) QR tags, or digital receipts (invoice OCR). Built-in on-premises AI automatically cuts out backgrounds, tags 20+ fashion attributes, and prepares clean studio cutouts with zero required API keys.

## Prerequisites
- Clear, well-lit photos of garments (mirror selfies, full-body outfit photos, or flat lays).
- Camera access for scanning physical items and QR codes.
- Digital receipts or invoice screenshots (PDF / PNG / JPEG) for e-commerce purchases.
- *(Optional)* A personal Google Gemini API key if you want to use Nano Banana generative photo reconstruction and studio inpainting.

## Step-by-Step Instructions

1. **Interactive Upload & Capture**:
   - Tap **Add Item** &rarr; select **Take Photo** or upload one or more outfit photos from your device.
   - Built-in duplicate detection instantly checks if you previously uploaded the same garment.
2. **AI Segmentation & Multi-Item Detection**:
   - The vision model isolates distinct garments (jackets, tops, skirts, pants, footwear, accessories) in a single pass.
3. **AI Matting & Clean Studio Photos**:
   - The built-in vision pipeline automatically keys out backgrounds into crisp, transparent PNG images for all accounts.
4. **Automatic Metadata Tagging**:
   - The on-premises AI extracts 20+ fashion attributes (colors, fabric composition, sub-category, dress code, brand, and condition).
5. **Advanced Generative Photo Repair (Nano Banana)**:
   - For users with a personal Google Gemini API key, Nano Banana inspects cropped items for occlusions (bags, hands) and frame boundaries, automatically outpainting and reconstructing missing fabric into complete studio photographs.
6. **Digital Receipts & DPP Tags**:
   - Switch to **Digital Import** to parse order confirmation emails or invoices, locking purchase price and verified sizes.
   - Tap **Scan QR (DPP)** on the label to import EU Digital Product Passport supply chain facts and care guidelines.
7. **Save to Closet**:
   - Tap **Save**. Items appear immediately in your Closet grid.

## Expected Results
Every garment appears in your digital wardrobe as a centered, clean studio-quality photograph with fully indexed search attributes and rich taxonomy tags.

## Troubleshooting
- **Cut-Off / Partial Garments in Photos**: Cleanly center the garment against a contrasting background. If you have an API key configured, Nano Banana can reconstruct clipped collars or hems automatically.
- **Lighting & Contrast**: For best results on dark garments, photograph against contrasting light backgrounds.
- **Receipt OCR Mismatches**: Use the interactive box selector on receipt images to manually designate individual product lines.

## Limitations
- High-resolution batch uploads (>5 items) process via asynchronous background queues to guarantee responsive performance without browser timeout.
- Nano Banana photorealistic image inpainting requires a user-supplied Google Gemini API key.
